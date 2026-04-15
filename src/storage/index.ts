import { localStorageProvider } from './LocalStorageProvider';
import type { StorageProvider } from './types';


class StorageManager {
    private readonly allProviders: StorageProvider[];
    private currentProvider: StorageProvider;

    constructor() {
        this.allProviders = [localStorageProvider];
        this.currentProvider = localStorageProvider;
    }

    get hasProviderSelected() {
        return !!this.currentProvider;
    }

    get provider() {
        return this.currentProvider;
    }

    addProvider(provider: StorageProvider): void {
        this.allProviders.push(provider);
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

// GoogleDriveProvider is only imported when the GDrive client ID env var is set,
// keeping it out of the main bundle for users who don't enable GDrive.
const gdriveClientId = import.meta.env.VITE_STORAGE_GDRIVE_CLIENT_ID;
if (gdriveClientId) {
    // Inline async IIFE so we can use await without .then() (satisfies promise/prefer-await-to-then)
    void (async () => {
        try {
            const gdriveModule = await import('./GoogleDriveProvider');
            storageManager.addProvider(new gdriveModule.GoogleDriveProvider(gdriveClientId));
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('Failed to load GoogleDriveProvider module:', err);
        }
    })();
}

export type { ProjectMeta, StorageProvider } from './types';
