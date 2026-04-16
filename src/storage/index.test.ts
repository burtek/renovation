import { storageManager } from './index';


describe('StorageManager', () => {
    it('hasProviderSelected returns true by default', () => {
        expect(storageManager.hasProviderSelected).toBe(true);
    });

    it('provider returns the default LocalStorageProvider', () => {
        expect(storageManager.provider).toBeDefined();
        expect(storageManager.provider.id).toBe('LS_OPFS');
    });

    it('providers lists all registered providers', () => {
        const list = storageManager.providers;
        expect(Array.isArray(list)).toBe(true);
        expect(list).toHaveLength(1);
        expect(list[0].id).toBe('LS_OPFS');
    });

    it('setProvider switches to a known provider', () => {
        storageManager.setProvider('LS_OPFS');
        expect(storageManager.provider.id).toBe('LS_OPFS');
    });

    it('setProvider warns and keeps current provider when id is unknown', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        });
        const before = storageManager.provider;

        storageManager.setProvider('DOES_NOT_EXIST');

        expect(storageManager.provider).toBe(before);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('DOES_NOT_EXIST'));

        warnSpy.mockRestore();
    });

    it('addProvider registers a new provider that setProvider can find', () => {
        const fakeProvider = {
            id: 'FAKE',
            label: 'Fake Storage',
            initialize: async () => {
            },
            listProjects: async () => [],
            loadProject: async () => null,
            saveProject: async () => {
            },
            createProject: async () => 'new-id',
            renameProject: async () => {
            },
            getProjectSize: async () => 0
        };

        storageManager.addProvider(fakeProvider);
        expect(storageManager.providers).toContain(fakeProvider);

        storageManager.setProvider('FAKE');
        expect(storageManager.provider.id).toBe('FAKE');

        // Reset back to local so other tests are not affected
        storageManager.setProvider('LS_OPFS');
    });
});

describe('StorageManager with VITE_STORAGE_GDRIVE_CLIENT_ID set', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_STORAGE_GDRIVE_CLIENT_ID', 'test-gdrive-client-id');
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it('registers GoogleDriveProvider when env var is set', async () => {
        const { storageManager: sm, allProvidersReady } = await import('./index');
        // Wait for the provider module to be dynamically imported and registered
        await allProvidersReady;
        // GoogleDriveProvider should have been registered
        expect(sm.providers.some(p => p.id === 'GDRIVE')).toBe(true);
    });
});
