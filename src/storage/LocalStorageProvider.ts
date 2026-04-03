import { v4 as uuidv4 } from 'uuid';

import type { AppData } from '../types';

import type { ProjectMeta, StorageProvider } from './types';
import { STORAGE_KEY_PREFIX } from './types';


interface StoredProjectRecord {
    name: string;
    lastModified?: string;
    [key: string]: unknown;
}

export class LocalStorageProvider implements StorageProvider {
    createProject(name: string): string {
        const id = uuidv4();
        const record: StoredProjectRecord = {
            name,
            lastModified: new Date().toISOString(),
            notes: [],
            tasks: [],
            expenses: [],
            calendarEvents: [],
            budget: 0
        };
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${id}`, JSON.stringify(record));
        return id;
    }

    getProjectSize(id: string): number {
        const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${id}`);
        return raw ? new TextEncoder().encode(raw).length : 0;
    }

    listProjects(): ProjectMeta[] {
        const projects: ProjectMeta[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(STORAGE_KEY_PREFIX)) {
                const id = key.slice(STORAGE_KEY_PREFIX.length);
                try {
                    const raw = localStorage.getItem(key);
                    if (raw) {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
                        const parsed = JSON.parse(raw) as StoredProjectRecord;
                        if (typeof parsed.name === 'string' && typeof parsed.lastModified === 'string') {
                            projects.push({ id, name: parsed.name, lastModified: parsed.lastModified });
                        }
                    }
                } catch {
                    // skip corrupted entries
                }
            }
        }
        return projects.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
    }

    loadProject(id: string): { meta: ProjectMeta; rawData: Partial<AppData> } | null {
        try {
            const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${id}`);
            if (!raw) {
                return null;
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            const parsed = JSON.parse(raw) as StoredProjectRecord;
            if (typeof parsed.name !== 'string') {
                return null;
            }
            const { name, lastModified, ...rest } = parsed;
            return {
                meta: { id, name, lastModified: lastModified ?? new Date().toISOString() },

                rawData: rest as Partial<AppData>
            };
        } catch {
            return null;
        }
    }

    renameProject(id: string, newName: string): void {
        const key = `${STORAGE_KEY_PREFIX}${id}`;
        const raw = localStorage.getItem(key);
        if (!raw) {
            return;
        }
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            const parsed = JSON.parse(raw) as StoredProjectRecord;
            parsed.name = newName;
            localStorage.setItem(key, JSON.stringify(parsed));
        } catch {
            // skip corrupted entry
        }
    }

    saveProject(id: string, name: string, data: AppData): void {
        const record: StoredProjectRecord = {
            name,
            lastModified: new Date().toISOString(),
            ...data
        };
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${id}`, JSON.stringify(record));
    }
}

export const localStorageProvider = new LocalStorageProvider();
