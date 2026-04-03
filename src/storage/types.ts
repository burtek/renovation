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
    listProjects: () => ProjectMeta[];
    loadProject: (id: string) => { meta: ProjectMeta; rawData: Partial<AppData> } | null;
    saveProject: (id: string, name: string, data: AppData) => void;
    createProject: (name: string) => string; // returns new project id (stores empty project)
    renameProject: (id: string, newName: string) => void;
    getProjectSize: (id: string) => number; // bytes used in storage
}
