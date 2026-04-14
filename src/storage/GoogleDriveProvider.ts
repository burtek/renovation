/* eslint-disable no-console */
import { v4 as uuidv4 } from 'uuid';

import type { AppData } from '../types';

import type { ProjectMeta, StorageProvider } from './types';


const GDRIVE_FILE_PREFIX = 'renovation-project-';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const GDRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

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
        && typeof (obj as Record<string, unknown>).meta === 'object'
        && (obj as Record<string, unknown>).meta !== null
        && 'data' in obj
        && typeof (obj as Record<string, unknown>).data === 'object'
        && (obj as Record<string, unknown>).data !== null
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

// ---------------------------------------------------------------------------
// GoogleDriveProvider
// ---------------------------------------------------------------------------

/**
 * Implements StorageProvider using the Google Drive appdata folder.
 * Files are invisible from the user's Drive UI; auth is handled
 * backend-less via Google Identity Services (OAuth2 implicit grant).
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
        if (!this.accessToken) {
            throw new Error('Google Drive not authenticated. Please reload and sign in again.');
        }
        const response = await fetch(
            `${DRIVE_API_BASE}${path}`,
            { headers: makeHeaders(this.accessToken) }
        );
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
        if (!this.accessToken) {
            throw new Error('Google Drive not authenticated. Please reload and sign in again.');
        }
        const response = await fetch(
            `${DRIVE_API_BASE}/files/${fileId}?alt=media`,
            { headers: makeHeaders(this.accessToken) }
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
        if (!this.accessToken) {
            throw new Error('Google Drive not authenticated. Please reload and sign in again.');
        }
        const boundary = 'renovation_gdrive_boundary';
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

        const headers = makeHeaders(this.accessToken, { 'Content-Type': `multipart/related; boundary=${boundary}` });
        const response = await fetch(url, { method, headers, body });
        if (!response.ok) {
            throw new Error(`Google Drive API error ${response.status}: ${response.statusText}`);
        }
    }

    private async getFileInfo(projectId: string): Promise<GDriveFileInfo | null> {
        const files = await this.listDriveFiles();
        return files.find(f => f.name === `${GDRIVE_FILE_PREFIX}${projectId}.json`) ?? null;
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
                },
                // eslint-disable-next-line @typescript-eslint/naming-convention
                error_callback: (error: { message: string; type: string }) => {
                    this.pendingTokenReject?.(new Error(error.message));
                    this.pendingTokenResolve = null;
                    this.pendingTokenReject = null;
                }
            });
        }
        return this.tokenClient;
    }

    private async listDriveFiles(): Promise<GDriveFileInfo[]> {
        const qs = [
            'spaces=appDataFolder',
            'fields=files(id,name,size,appProperties)',
            `q=name+contains+'${GDRIVE_FILE_PREFIX}'`
        ].join('&');
        const result = await this.driveGet<{ files: GDriveFileInfo[] }>(`/files?${qs}`);
        return result.files;
    }

    private requestNewToken(prompt?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.pendingTokenResolve = resolve;
            this.pendingTokenReject = reject;
            const client = this.getOrCreateTokenClient();
            client.requestAccessToken(prompt === undefined ? undefined : { prompt });
        });
    }
}
