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
// Provider option — the shape passed to the storage-selection modal.
// ---------------------------------------------------------------------------
export interface ProviderOption {
    /** Internal provider identifier (e.g. 'LS_OPFS', 'GDRIVE'). */
    providerId: string;
    /** Display name shown as the button title. */
    name: string;
    /** One-line description shown below the title. */
    description: string;
    /** Emoji (or icon class) shown next to the title. */
    icon: string;
    /** Whether the provider module has finished loading and can be selected. */
    ready: boolean;
    /** Label shown while the selection action is in-flight; defaults to 'Loading…'. */
    inFlightLabel?: string;
}

// ---------------------------------------------------------------------------
// Dynamic provider registration
// Each entry is [envKeyValue, importerFn, displayMeta]. To add a new optional
// provider, append a new line here — no other changes needed (Open-Closed principle).
// ---------------------------------------------------------------------------
type ProviderConstructor = new (key: string) => StorageProvider;
type DynamicProviderEntry = readonly [
    key: string | undefined,
    importer: () => Promise<ProviderConstructor>,
    meta: Omit<ProviderOption, 'ready'>
];

const dynamicProviders: DynamicProviderEntry[] = [
    [
        import.meta.env.VITE_STORAGE_GDRIVE_CLIENT_ID,
        async () => (await import('./GoogleDriveProvider')).GoogleDriveProvider,
        {
            providerId: 'GDRIVE',
            name: 'Google Drive',
            description: 'Store projects in your Google Drive (app data only)',
            icon: '☁️',
            inFlightLabel: 'Connecting…'
        }
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

/**
 * Builds the list of provider options to display in the storage-selection modal.
 * The local provider is always first and always ready.
 * Optional providers are included when their env key is set, with `ready` reflecting
 * whether the dynamic import has completed.
 */
export function getAvailableProviders(optionalProvidersReady: boolean): ProviderOption[] {
    return [
        {
            providerId: localStorageProvider.id,
            name: localStorageProvider.label,
            description: localStorageProvider.description,
            icon: localStorageProvider.icon,
            ready: true
        },
        ...dynamicProviders
            .filter(([key]) => Boolean(key))
            .map(([, , meta]) => ({ ...meta, ready: optionalProvidersReady }))
    ];
}

export type { ProjectMeta, StorageProvider } from './types';
