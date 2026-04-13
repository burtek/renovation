/* eslint-disable no-console */
import { v4 as uuidv4 } from 'uuid';

import type { AppData } from '../types';

import type { ProjectMeta, StorageProvider } from './types';
import { STORAGE_KEY_PREFIX } from './types';


interface StoredProjectRecord {
    meta: Omit<ProjectMeta, 'id'>;
    data: Partial<AppData>;
}

function isStoredProjectRecord(obj: unknown): obj is StoredProjectRecord {
    return typeof obj === 'object' && obj !== null
        && 'meta' in obj && typeof obj.meta === 'object' && obj.meta !== null
        && 'name' in obj.meta && typeof obj.meta.name === 'string'
        && 'lastModified' in obj.meta && typeof obj.meta.lastModified === 'string'
        && 'data' in obj && typeof obj.data === 'object' && obj.data !== null;
}

/**
 * Implements StorageProvider using the browser's localStorage and OPFS APIs.
 * Projects are stored under keys with the format "renovation-project-{id}" and
 *   values containing the project's name, last modified timestamp, and app data.
 */
export class LocalStorageProvider implements StorageProvider {
    readonly id = 'LS_OPFS';
    private mode: 'localStorage' | 'opfs';

    constructor() {
        this.mode = 'storage' in navigator && navigator.storage && 'getDirectory' in navigator.storage
            ? 'opfs'
            : 'localStorage';
    }

    get label() {
        return {
            localStorage: 'Local Storage',
            opfs: 'Local Storage (OPFS)'
        }[this.mode];
    }

    async createProject(name: string): Promise<string> {
        const id = uuidv4();
        const record: StoredProjectRecord = {
            meta: { name, lastModified: new Date().toISOString() },
            data: {
                notes: [],
                tasks: [],
                expenses: [],
                calendarEvents: [],
                budget: 0
            }
        };
        if (this.mode === 'opfs') {
            try {
                await this.saveToOPFS(id, record);
            } catch (error) {
                console.warn('OPFS create failed, falling back to localStorage mode:', error);
        // always write to localStorage for backup, backward compatibility and easier debugging
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${id}`, JSON.stringify(record));
        if (this.mode === 'opfs') {
            try {
                await this.saveToOPFS(id, record);
            } catch (error) {
                console.warn('Falling back to localStorage after OPFS createProject failure', error);
                this.mode = 'localStorage';
            }
        }
        return id;
    }

    async getProjectSize(id: string): Promise<number> {
        if (this.mode === 'opfs') {
            try {
                const root = await navigator.storage.getDirectory();
                const fileHandle = await root.getFileHandle(`${STORAGE_KEY_PREFIX}${id}`);
                const file = await fileHandle.getFile();
                return file.size;
            } catch {
                // fallback to localStorage if OPFS entry is missing/corrupted
            }
        }
        const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${id}`);
        return raw ? new TextEncoder().encode(raw).length : 0;
    }

    async initialize(): Promise<void> {
        if (this.mode !== 'opfs') {
            return;
        }

        // request OPFS permissions
        try {
            const root = await navigator.storage.getDirectory();
            if ('requestPermission' in root && typeof root.requestPermission === 'function') {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
                const permissionState = await root.requestPermission({ mode: 'readwrite' });
                if (permissionState !== 'granted') {
                    console.error(
                        `OPFS permission state was "${permissionState}", falling back to localStorage mode`
                    );
                    this.mode = 'localStorage';
                    return;
                }
            }
        } catch (error) {
            console.error('OPFS initialization failed, falling back to localStorage mode:', error);
            // if permission request fails, fallback to localStorage mode
            this.mode = 'localStorage';
            return;
        }

        // sync LS and OPFS
        const allKeys = new Set<string>();
        Object.keys(localStorage)
            .filter(key => key.startsWith(STORAGE_KEY_PREFIX))
            .forEach(key => allKeys.add(key.slice(STORAGE_KEY_PREFIX.length)));
        try {
            const root = await navigator.storage.getDirectory();
            for await (const [name, handle] of root) {
                if (name.startsWith(STORAGE_KEY_PREFIX) && handle.kind === 'file') {
                    allKeys.add(name.slice(STORAGE_KEY_PREFIX.length));
                }
            }
        } catch {
            // if OPFS access fails for some reason after initialization, fallback to localStorage mode
            console.error('OPFS access failed after initialization, falling back to localStorage mode');
            this.mode = 'localStorage';
            return;
        }

        for (const id of allKeys) {
            try {
                // eslint-disable-next-line no-await-in-loop
                const [opfsParsed, fileHandle] = await this.readFromOPFS(id, { create: true, throwOnCorrupted: false });

                const lsRaw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${id}`);
                let lsParsed: unknown = null;
                if (lsRaw) {
                    try {
                        lsParsed = JSON.parse(lsRaw) as unknown;
                    } catch {
                        console.warn(`Project ${id} is corrupted in localStorage, treating it as missing during sync`);
                    }
                }

                let updateLS: StoredProjectRecord | null = null;
                let updateOPFS: StoredProjectRecord | null = null;
                if (isStoredProjectRecord(opfsParsed) && isStoredProjectRecord(lsParsed)) {
                    // both OPFS and LS entries exist and are valid - keep the newer one
                    if (opfsParsed.meta.lastModified.localeCompare(lsParsed.meta.lastModified) >= 0) {
                        // OPFS is newer - update LS
                        updateLS = opfsParsed;
                    } else {
                        // LS is newer - update OPFS
                        updateOPFS = lsParsed;
                    }
                } else if (isStoredProjectRecord(opfsParsed) && !isStoredProjectRecord(lsParsed)) {
                    // only OPFS entry is valid - copy to LS
                    updateLS = opfsParsed;
                } else if (!isStoredProjectRecord(opfsParsed) && isStoredProjectRecord(lsParsed)) {
                    // only LS entry is valid - copy to OPFS
                    updateOPFS = lsParsed;
                } else {
                    // if neither is valid, skip this entry
                    console.warn(`Project ${id} is corrupted in both OPFS and localStorage, skipping`);
                }

                if (updateLS) {
                    localStorage.setItem(`${STORAGE_KEY_PREFIX}${id}`, JSON.stringify(updateLS));
                }
                if (updateOPFS) {
                    // eslint-disable-next-line no-await-in-loop
                    await this.saveToOPFS(fileHandle, updateOPFS);
                }
            } catch (error) {
                console.error(`Failed to sync project ${id} between localStorage and OPFS:`, error);
                // if any error occurs during syncing of this entry, skip it and continue with others
            }
        }
    }

    async listProjects(): Promise<ProjectMeta[]> {
        const projects: ProjectMeta[] = [];

        if (this.mode === 'opfs') {
            try {
                const root = await navigator.storage.getDirectory();
                for await (const [name, handle] of root) {
                    if (name.startsWith(STORAGE_KEY_PREFIX) && handle.kind === 'file') {
                        const id = name.slice(STORAGE_KEY_PREFIX.length);
                        try {
                            const [parsed] = await this.readFromOPFS(id);
                            projects.push({ id, name: parsed.meta.name, lastModified: parsed.meta.lastModified });
                        } catch {
                            // skip corrupted entries
                        }
                    }
                }
                return projects.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
            } catch {
                // if OPFS access fails for some reason after initialization, fallback to localStorage mode
            }
        }

        const matchingLSKeys = Object.keys(localStorage).filter(key => key.startsWith(STORAGE_KEY_PREFIX));
        for (const key of matchingLSKeys) {
            const id = key.slice(STORAGE_KEY_PREFIX.length);
            try {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const raw = localStorage.getItem(key)!;
                const parsed = JSON.parse(raw) as unknown;
                if (isStoredProjectRecord(parsed)) {
                    projects.push({ id, name: parsed.meta.name, lastModified: parsed.meta.lastModified });
                }
            } catch {
                // skip corrupted entries
            }
        }

        return projects.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
    }

    async loadProject(id: string): Promise<{ meta: ProjectMeta; rawData: Partial<AppData> } | null> {
        if (this.mode === 'opfs') {
            try {
                const [parsed] = await this.readFromOPFS(id);
                return { meta: { ...parsed.meta, id }, rawData: parsed.data };
            } catch {
                // if OPFS access fails for some reason after initialization, fallback to localStorage mode
            }
        }

        try {
            const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${id}`);
            if (!raw) {
                return null;
            }
            const parsed = JSON.parse(raw) as unknown;
            if (!isStoredProjectRecord(parsed)) {
                return null;
            }
            return { meta: { ...parsed.meta, id }, rawData: parsed.data };
        } catch {
            return null;
        }
    }

    async renameProject(id: string, newName: string): Promise<void> {
        const key = `${STORAGE_KEY_PREFIX}${id}`;

        let current: StoredProjectRecord | null = null;
        if (this.mode === 'opfs') {
            try {
                let handle: FileSystemFileHandle;
                [current, handle] = await this.readFromOPFS(id);
                current.meta.name = newName;
                current.meta.lastModified = new Date().toISOString();
                await this.saveToOPFS(handle, current);
            } catch {
                // if OPFS access fails for some reason after initialization, fallback to localStorage mode
            }
        }

        if (current) {
            localStorage.setItem(key, JSON.stringify(current));
            return;
        }

        const raw = localStorage.getItem(key);
        if (!raw) {
            return;
        }
        try {
            const parsed = JSON.parse(raw) as unknown;
            if (!isStoredProjectRecord(parsed)) {
                return;
            }
            parsed.meta.name = newName;
            localStorage.setItem(key, JSON.stringify(parsed));
        } catch {
            // skip corrupted entry
        }
    }

    async saveProject(id: string, name: string, data: AppData): Promise<void> {
        const record: StoredProjectRecord = {
            meta: { name, lastModified: new Date().toISOString() },
            data
        };

        if (this.mode === 'opfs') {
            try {
                await this.saveToOPFS(id, record, true);
            } catch {
                // if OPFS access fails for some reason after initialization, fallback to localStorage mode
                console.error('OPFS access failed during save, falling back to localStorage mode');
                this.mode = 'localStorage';
            }
        }

        localStorage.setItem(`${STORAGE_KEY_PREFIX}${id}`, JSON.stringify(record));
    }

    private async readFromOPFS(id: string, args?: { create?: boolean; throwOnCorrupted?: true }): Promise<DataHandleTuple>;
    private async readFromOPFS(id: string, args: { create?: boolean; throwOnCorrupted: false }): Promise<DataHandleTuple | InvalidHandleTuple>;
    private async readFromOPFS(id: string, { create = false, throwOnCorrupted = true } = {}): Promise<DataHandleTuple | InvalidHandleTuple> {
        const root = await navigator.storage.getDirectory();
        const fileHandle = await root.getFileHandle(`${STORAGE_KEY_PREFIX}${id}`, { create });
        try {
            const file = await fileHandle.getFile();
            const raw = await file.text();
            const parsed = JSON.parse(raw) as unknown;
            if (isStoredProjectRecord(parsed)) {
                return [parsed, fileHandle];
            }
        } catch {
            // empty file or invalid JSON treated as corrupted
        }
        if (throwOnCorrupted) {
            throw new Error(`Invalid project record format for project ${id} in OPFS`);
        }
        return [null, fileHandle];
    }

    private async saveToOPFS(id: string, record: StoredProjectRecord, create?: boolean): Promise<void>;
    private async saveToOPFS(id: FileSystemFileHandle, record: StoredProjectRecord): Promise<void>;
    private async saveToOPFS(
        id: string | FileSystemFileHandle,
        record: StoredProjectRecord,
        create = true
    ): Promise<void> {
        let fileHandle: FileSystemFileHandle;
        if (typeof id === 'string') {
            const root = await navigator.storage.getDirectory();
            fileHandle = await root.getFileHandle(`${STORAGE_KEY_PREFIX}${id}`, { create });
        } else {
            fileHandle = id;
        }
        const writableStream = await fileHandle.createWritable();
        await writableStream.write(JSON.stringify(record));
        await writableStream.close();
    }
}
type DataHandleTuple = [StoredProjectRecord, FileSystemFileHandle];
type InvalidHandleTuple = [null, FileSystemFileHandle];

export const localStorageProvider = new LocalStorageProvider();
