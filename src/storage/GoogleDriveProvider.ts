/* eslint-disable no-console */
import { v4 as uuidv4 } from 'uuid';

import type { AppData } from '../types';

import type { ProjectMeta, StorageProvider } from './types';
import { STORAGE_KEY_PREFIX } from './types';


const GDRIVE_FILE_PREFIX = STORAGE_KEY_PREFIX;
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const GDRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

/** HTTP status code for an expired or invalid bearer token. */
const HTTP_UNAUTHORIZED = 401;

// ---------------------------------------------------------------------------
// Minimal TypeScript declarations for Google Identity Services (GIS)
// ---------------------------------------------------------------------------

interface TokenClientConfig {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    error_callback?: (error: { message: string; type: string }) => void;
}

interface TokenClient {
    requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

interface TokenResponse {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    access_token: string;
    error?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    error_description?: string;
}

declare global {
    interface Window {
        google?: { accounts: { oauth2: { initTokenClient: (config: TokenClientConfig) => TokenClient } } };
    }
}

// ---------------------------------------------------------------------------
// Internal data shapes
// ---------------------------------------------------------------------------

interface StoredProjectRecord {
    meta: Omit<ProjectMeta, 'id'>;
    data: Partial<AppData>;
}

function isStoredProjectRecord(obj: unknown): obj is StoredProjectRecord {
    return (
        typeof obj === 'object'
        && obj !== null
        && 'meta' in obj
        && typeof obj.meta === 'object'
        && obj.meta !== null
        && 'name' in obj.meta
        && typeof obj.meta.name === 'string'
        && 'lastModified' in obj.meta
        && typeof obj.meta.lastModified === 'string'
        && 'data' in obj
        && typeof obj.data === 'object'
        && obj.data !== null
    );
}

interface GDriveFileInfo {
    id: string;
    name: string;
    size?: string;
    appProperties?: {
        projectName?: string;
        lastModified?: string;
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadGIS(): Promise<void> {
    if (window.google?.accounts.oauth2) {
        return;
    }
    await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.onload = () => {
            resolve();
        };
        script.onerror = () => {
            reject(new Error('Failed to load Google Identity Services library'));
        };
        document.head.appendChild(script);
    });
}

/** Build a fetch `headers` init with an Authorization bearer token. */
function makeHeaders(token: string, extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { ...extra };
    // 'Authorization' starts with a capital letter, which violates the camelCase naming-convention
    // rule. Using bracket notation with an eslint-disable comment is the cleanest workaround.
    // eslint-disable-next-line @typescript-eslint/dot-notation
    headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

/** Escape a value for use inside a Drive `q` query string (single-quoted strings). */
function escapeDriveQueryValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ---------------------------------------------------------------------------
// GoogleDriveProvider
// ---------------------------------------------------------------------------

/**
 * Implements StorageProvider using the Google Drive appdata folder.
 * Files are invisible from the user's Drive UI; auth is handled
 * backend-less via Google Identity Services (OAuth2 token model).
 * The access token is kept only in memory – never persisted to any
 * browser storage.
 */
export class GoogleDriveProvider implements StorageProvider {
    readonly id = 'GDRIVE';
    readonly label = 'Google Drive';

    private accessToken: string | null = null;
    private pendingTokenReject: ((error: Error) => void) | null = null;
    private pendingTokenResolve: ((token: string) => void) | null = null;
    private tokenClient: TokenClient | null = null;
    /**
     * When a token request is in-flight this holds its Promise so that concurrent
     * callers (e.g. multiple 401 retries racing) share the same request instead of
     * overwriting each other's resolve/reject callbacks.
     */
    private tokenRequestInFlight: Promise<string> | null = null;

    constructor(private readonly clientId: string) {
        // clientId captured as parameter property
    }

    // ── StorageProvider – public methods (alphabetical) ──────────────────

    async createProject(name: string): Promise<string> {
        const id = uuidv4();
        const now = new Date().toISOString();
        const record: StoredProjectRecord = {
            meta: { name, lastModified: now },
            data: {
                notes: [],
                tasks: [],
                expenses: [],
                calendarEvents: [],
                budget: 0
            }
        };
        await this.driveMultipart(
            'POST',
            `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`,
            {
                name: `${GDRIVE_FILE_PREFIX}${id}.json`,
                parents: ['appDataFolder'],
                appProperties: { projectName: name, lastModified: now }
            },
            JSON.stringify(record)
        );
        return id;
    }

    async getProjectSize(id: string): Promise<number> {
        const info = await this.getFileInfo(id);
        if (!info?.size) {
            return 0;
        }
        return parseInt(info.size, 10);
    }

    async initialize(): Promise<void> {
        await loadGIS();
        this.accessToken = await this.requestNewToken();
    }

    async listProjects(): Promise<ProjectMeta[]> {
        const allFiles = await this.listDriveFiles();
        const validFiles = allFiles.filter(
            f => f.name.startsWith(GDRIVE_FILE_PREFIX) && f.name.endsWith('.json')
        );

        const results = await Promise.all(
            validFiles.map(async file => {
                const id = file.name.slice(GDRIVE_FILE_PREFIX.length, -'.json'.length);

                // Fast path: project name stored in appProperties (avoids extra fetch per project)
                if (file.appProperties?.projectName && file.appProperties.lastModified) {
                    return {
                        id,
                        name: file.appProperties.projectName,
                        lastModified: file.appProperties.lastModified
                    };
                }

                // Slow path: fetch file content (handles files without appProperties)
                try {
                    const mediaResponse = await this.driveGetMedia(file.id);
                    const json: unknown = await mediaResponse.json();
                    if (isStoredProjectRecord(json)) {
                        return { id, name: json.meta.name, lastModified: json.meta.lastModified };
                    }
                } catch {
                    // skip corrupted or inaccessible entries
                }
                return null;
            })
        );

        return results
            .filter((p): p is ProjectMeta => p !== null)
            .sort((a, b) => b.lastModified.localeCompare(a.lastModified));
    }

    async loadProject(id: string): Promise<{ meta: ProjectMeta; rawData: Partial<AppData> } | null> {
        const info = await this.getFileInfo(id);
        if (!info) {
            return null;
        }
        try {
            const mediaResponse = await this.driveGetMedia(info.id);
            const json: unknown = await mediaResponse.json();
            if (!isStoredProjectRecord(json)) {
                return null;
            }
            return {
                meta: { id, name: json.meta.name, lastModified: json.meta.lastModified },
                rawData: json.data
            };
        } catch {
            return null;
        }
    }

    async renameProject(id: string, newName: string): Promise<void> {
        const info = await this.getFileInfo(id);
        if (!info) {
            console.warn(`GoogleDriveProvider.renameProject: project ${id} not found`);
            return;
        }

        const mediaResponse = await this.driveGetMedia(info.id);
        const json: unknown = await mediaResponse.json();
        if (!isStoredProjectRecord(json)) {
            return;
        }
        const now = new Date().toISOString();
        json.meta.name = newName;
        json.meta.lastModified = now;

        await this.driveMultipart(
            'PATCH',
            `${DRIVE_UPLOAD_BASE}/files/${info.id}?uploadType=multipart`,
            {
                name: `${GDRIVE_FILE_PREFIX}${id}.json`,
                appProperties: { projectName: newName, lastModified: now }
            },
            JSON.stringify(json)
        );
    }

    async saveProject(id: string, name: string, data: AppData): Promise<void> {
        const now = new Date().toISOString();
        const record: StoredProjectRecord = {
            meta: { name, lastModified: now },
            data
        };
        const content = JSON.stringify(record);
        const info = await this.getFileInfo(id);
        const metadata = {
            name: `${GDRIVE_FILE_PREFIX}${id}.json`,
            appProperties: { projectName: name, lastModified: now }
        };

        if (info) {
            await this.driveMultipart(
                'PATCH',
                `${DRIVE_UPLOAD_BASE}/files/${info.id}?uploadType=multipart`,
                metadata,
                content
            );
        } else {
            await this.driveMultipart(
                'POST',
                `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`,
                { ...metadata, parents: ['appDataFolder'] },
                content
            );
        }
    }

    // ── Private helpers (alphabetical) ───────────────────────────────────

    private async driveGet<T>(path: string): Promise<T> {
        const response = await this.fetchWithAuthRetry(`${DRIVE_API_BASE}${path}`, {});
        if (!response.ok) {
            throw new Error(`Google Drive API error ${response.status}: ${response.statusText}`);
        }
        const json: unknown = await response.json();
        // The shape of `T` is always a well-typed Google Drive API response object
        // (e.g. `{ files: GDriveFileInfo[] }`). We trust the API contract here since
        // the response has already been verified as ok (2xx status above).
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        return json as T;
    }

    private async driveGetMedia(fileId: string): Promise<Response> {
        const response = await this.fetchWithAuthRetry(
            `${DRIVE_API_BASE}/files/${fileId}?alt=media`,
            {}
        );
        if (!response.ok) {
            throw new Error(`Google Drive API error ${response.status}: ${response.statusText}`);
        }
        return response;
    }

    private async driveMultipart(
        method: 'POST' | 'PATCH',
        url: string,
        metadata: object,
        content: string
    ): Promise<void> {
        // Use a unique boundary per request to ensure correctness even if the JSON content
        // happens to contain the boundary string.
        const boundary = `renovation_gdrive_boundary_${uuidv4()}`;
        const metaStr = JSON.stringify(metadata);
        const body = [
            `--${boundary}`,
            'Content-Type: application/json; charset=UTF-8',
            '',
            metaStr,
            `--${boundary}`,
            'Content-Type: application/json; charset=UTF-8',
            '',
            content,
            `--${boundary}--`
        ].join('\r\n');

        const response = await this.fetchWithAuthRetry(
            url,
            { method, body },
            { 'Content-Type': `multipart/related; boundary=${boundary}` }
        );
        if (!response.ok) {
            throw new Error(`Google Drive API error ${response.status}: ${response.statusText}`);
        }
    }

    /**
     * Wraps `fetch` with automatic token-refresh on 401.
     * On the first `HTTP_UNAUTHORIZED` response the provider attempts a silent
     * GIS refresh (empty prompt = no user interaction) and retries once.
     * If the silent refresh fails, a descriptive "session expired" error is thrown
     * so the UI can prompt the user to reconnect.
     */
    private async fetchWithAuthRetry(
        url: string,
        init: Omit<RequestInit, 'headers'>,
        extraHeaders?: Record<string, string>
    ): Promise<Response> {
        if (!this.accessToken) {
            throw new Error('Google Drive not authenticated. Please reload and sign in again.');
        }

        const firstResponse = await fetch(url, {
            ...init,
            headers: makeHeaders(this.accessToken, extraHeaders)
        });

        if (firstResponse.status !== HTTP_UNAUTHORIZED) {
            return firstResponse;
        }

        // Token may have expired – attempt a silent refresh.
        // An empty string prompt tells GIS to refresh without showing a user consent dialog.
        try {
            this.accessToken = await this.requestNewToken(/* prompt= */ '');
        } catch {
            throw new Error('Google Drive session expired. Please reconnect to Google Drive.');
        }

        return await fetch(url, {
            ...init,
            headers: makeHeaders(this.accessToken, extraHeaders)
        });
    }

    /**
     * Finds the Drive file entry for a specific project ID using a targeted query.
     * This avoids fetching the full project list when only one file is needed.
     * `URLSearchParams` ensures the `q=` value is correctly URL-encoded so project
     * IDs containing characters like `&`, `#`, or `%` don't break the request.
     */
    private async getFileInfo(projectId: string): Promise<GDriveFileInfo | null> {
        const fileName = `${GDRIVE_FILE_PREFIX}${projectId}.json`;
        const escapedName = escapeDriveQueryValue(fileName);
        const qs = new URLSearchParams({
            spaces: 'appDataFolder',
            fields: 'files(id,name,size,appProperties)',
            pageSize: '1',
            q: `name='${escapedName}'`
        });
        const result = await this.driveGet<{ files: GDriveFileInfo[] }>(`/files?${qs.toString()}`);
        return result.files[0] ?? null;
    }

    private getOrCreateTokenClient(): TokenClient {
        if (!this.tokenClient) {
            if (!window.google?.accounts.oauth2) {
                throw new Error('Google Identity Services not loaded');
            }
            this.tokenClient = window.google.accounts.oauth2.initTokenClient({
                // eslint-disable-next-line @typescript-eslint/naming-convention
                client_id: this.clientId,
                scope: GDRIVE_SCOPE,
                callback: (response: TokenResponse) => {
                    if (response.error) {
                        const errMsg = response.error_description ?? response.error;
                        this.pendingTokenReject?.(new Error(errMsg));
                    } else {
                        this.pendingTokenResolve?.(response.access_token);
                    }
                    this.pendingTokenResolve = null;
                    this.pendingTokenReject = null;
                    this.tokenRequestInFlight = null;
                },
                // eslint-disable-next-line @typescript-eslint/naming-convention
                error_callback: (error: { message: string; type: string }) => {
                    this.pendingTokenReject?.(new Error(error.message));
                    this.pendingTokenResolve = null;
                    this.pendingTokenReject = null;
                    this.tokenRequestInFlight = null;
                }
            });
        }
        return this.tokenClient;
    }

    /**
     * Lists all Drive files in the appdata folder matching the project prefix.
     * Handles pagination automatically so all projects are returned even if there
     * are more than the default page size.
     */
    private async listDriveFiles(): Promise<GDriveFileInfo[]> {
        const files: GDriveFileInfo[] = [];
        let pageToken: string | undefined;

        // Pages must be fetched sequentially since each page's token comes from the previous response.

        while (true) {
            const qsParts = [
                'spaces=appDataFolder',
                'fields=nextPageToken,files(id,name,size,appProperties)',
                'pageSize=1000',
                `q=name+contains+'${GDRIVE_FILE_PREFIX}'`
            ];
            if (pageToken !== undefined) {
                qsParts.push(`pageToken=${encodeURIComponent(pageToken)}`);
            }
            // eslint-disable-next-line no-await-in-loop
            const result = await this.driveGet<{ files?: GDriveFileInfo[]; nextPageToken?: string }>(
                `/files?${qsParts.join('&')}`
            );
            files.push(...result.files ?? []);
            pageToken = result.nextPageToken;
            if (pageToken === undefined) {
                break;
            }
        }

        return files;
    }

    private requestNewToken(prompt?: string): Promise<string> {
        // Deduplicate concurrent token requests – if one is already in-flight, reuse it.
        // This prevents a race where multiple 401 retries overwrite each other's callbacks.
        if (this.tokenRequestInFlight !== null) {
            return this.tokenRequestInFlight;
        }
        // Capture resolve/reject outside the executor so we can store the reference BEFORE
        // calling requestAccessToken. The GIS library may invoke the callback synchronously,
        // which would clear tokenRequestInFlight, but we need that cleared AFTER we set it.
        const promise = new Promise<string>((resolve, reject) => {
            this.pendingTokenResolve = resolve;
            this.pendingTokenReject = reject;
        });
        // Set BEFORE calling requestAccessToken so that the synchronous GIS callback clears
        // the correct reference (and doesn't accidentally leave a stale resolved promise).
        this.tokenRequestInFlight = promise;
        const client = this.getOrCreateTokenClient();
        client.requestAccessToken(prompt === undefined ? undefined : { prompt });
        return promise;
    }
}
