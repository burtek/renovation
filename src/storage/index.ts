import { GoogleDriveProvider } from './GoogleDriveProvider';
import { localStorageProvider } from './LocalStorageProvider';
import type { StorageProvider } from './types';


class StorageManager {
    private readonly allProviders: StorageProvider[];
    private currentProvider: StorageProvider;

    constructor() {
        const providers: StorageProvider[] = [localStorageProvider];
        const gdriveClientId = import.meta.env.VITE_STORAGE_GDRIVE_CLIENT_ID;
        if (gdriveClientId) {
            providers.push(new GoogleDriveProvider(gdriveClientId));
        }
        this.allProviders = providers;
        this.currentProvider = localStorageProvider;
    }

    get hasProviderSelected() {
        return !!this.currentProvider;
    }

    get provider() {
        return this.currentProvider;
    }

    setProvider(newProvider: string) {
        const found = this.allProviders.find(p => p.id === newProvider);
        if (found) {
            this.currentProvider = found;
        } else {
            // eslint-disable-next-line no-console
            console.warn(`Storage provider ${newProvider} not found, keeping current provider ${this.currentProvider.id}`);
        }
    }

    get providers() {
        return this.allProviders;
    }
}

export const storageManager = new StorageManager();
export type { ProjectMeta, StorageProvider } from './types';
