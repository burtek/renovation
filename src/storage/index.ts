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

// Resolves with the set of optional provider IDs that successfully loaded and registered.
// Providers that failed to import/register are NOT in the set, so callers can disable their buttons.
const { promise: allProvidersReadyPromise, resolve: resolveAllProviders }
    = Promise.withResolvers<ReadonlySet<string>>();
export const allProvidersReady: Promise<ReadonlySet<string>> = allProvidersReadyPromise;

void (async () => {
    const registeredIds = new Set<string>();
    await Promise.allSettled(
        dynamicProviders.map(async ([key, importer, meta]) => {
            if (!key) {
                return;
            }
            try {
                const providerConstructor = await importer();
                // eslint-disable-next-line new-cap
                storageManager.addProvider(new providerConstructor(key));
                registeredIds.add(meta.providerId);
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error('Failed to load dynamic storage provider:', err);
            }
        })
    );
    resolveAllProviders(registeredIds);
})();

/**
 * Builds the list of provider options to display in the storage-selection modal.
 * The local provider is always first and always ready.
 * Optional providers are included when their env key is set; `ready` is true only
 * for providers whose ID is present in `registeredIds` — failed imports remain
 * `ready: false` even after `allProvidersReady` resolves.
 *
 * Pass the result of `await allProvidersReady` (or an empty Set before it resolves)
 * as `registeredIds`. This keeps the function pure and the React `useMemo` lint-clean.
 */
export function getAvailableProviders(registeredIds: ReadonlySet<string>): ProviderOption[] {
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
            .map(([, , meta]) => ({ ...meta, ready: registeredIds.has(meta.providerId) }))
    ];
}

export type { ProjectMeta, StorageProvider } from './types';
