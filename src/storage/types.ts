import type { AppData } from '../types';


export const STORAGE_KEY_PREFIX = 'renovation-project-';
export const ACTIVE_PROJECT_KEY = 'renovation-active-project';
export const LEGACY_DATA_KEY = 'renovation-data';

export interface ProjectMeta {
    id: string;
    name: string;
    lastModified: string; // ISO string
}

export interface StorageProvider {
    id: string;
    label: string;
    icon: string;
    description: string;

    initialize: () => Promise<void>; // perform any async setup if needed (e.g. OPFS permission request)

    listProjects: () => Promise<ProjectMeta[]>;
    loadProject: (id: string) => Promise<{ meta: ProjectMeta; rawData: Partial<AppData> } | null>;
    saveProject: (id: string, name: string, data: AppData) => Promise<void>;
    createProject: (name: string) => Promise<string>; // returns new project id (stores empty project)
    renameProject: (id: string, newName: string) => Promise<void>;
    getProjectSize: (id: string) => Promise<number>; // bytes used in storage
}
