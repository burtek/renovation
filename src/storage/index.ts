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

// ---------------------------------------------------------------------------
// Dynamic provider registration
// Each entry is [envKeyValue, importerFn]. To add a new optional provider,
// append a new line here — no other changes needed (Open-Closed principle).
// ---------------------------------------------------------------------------
type ProviderConstructor = new (key: string) => StorageProvider;
type DynamicProviderEntry = readonly [string | undefined, () => Promise<ProviderConstructor>];

const dynamicProviders: DynamicProviderEntry[] = [
    [
        import.meta.env.VITE_STORAGE_GDRIVE_CLIENT_ID,
        async () => (await import('./GoogleDriveProvider')).GoogleDriveProvider
    ]
];

// True when at least one optional provider env var is set — drives the provider-selection UI.
export const hasOptionalProviders = dynamicProviders.some(([key]) => Boolean(key));

// Resolves once all configured optional providers have been loaded and registered.
const { promise: allProvidersReadyPromise, resolve: resolveAllProviders }
    = Promise.withResolvers<undefined>();
export const allProvidersReady: Promise<undefined> = allProvidersReadyPromise;

void (async () => {
    await Promise.allSettled(
        dynamicProviders.map(async ([key, importer]) => {
            if (!key) {
                return;
            }
            try {
                const providerConstructor = await importer();
                // eslint-disable-next-line new-cap
                storageManager.addProvider(new providerConstructor(key));
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error('Failed to load dynamic storage provider:', err);
            }
        })
    );
    resolveAllProviders(undefined);
})();

export type { ProjectMeta, StorageProvider } from './types';
