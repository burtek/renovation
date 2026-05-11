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
            icon: '🔧',
            description: 'Fake storage for testing',
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

        try {
            expect(storageManager.providers).toContain(fakeProvider);

            storageManager.setProvider('FAKE');
            expect(storageManager.provider.id).toBe('FAKE');
        } finally {
            // Reset back to local and remove the fake provider so other tests are not affected
            storageManager.setProvider('LS_OPFS');
            const fakeProviderIndex = storageManager.providers.indexOf(fakeProvider);
            if (fakeProviderIndex !== -1) {
                storageManager.providers.splice(fakeProviderIndex, 1);
            }
        }
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

describe('getAvailableProviders', () => {
    it('always includes the local provider first with ready:true', async () => {
        const { getAvailableProviders } = await import('./index');
        const options = getAvailableProviders(new Set());
        expect(options[0].providerId).toBe('LS_OPFS');
        expect(options[0].ready).toBe(true);
    });

    it('returns only the local provider when no env keys are set', async () => {
        // VITE_STORAGE_GDRIVE_CLIENT_ID is not set in this test suite
        const { getAvailableProviders } = await import('./index');
        const options = getAvailableProviders(new Set());
        expect(options).toHaveLength(1);
        expect(options[0].providerId).toBe('LS_OPFS');
    });
});

describe('getAvailableProviders with VITE_STORAGE_GDRIVE_CLIENT_ID set', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_STORAGE_GDRIVE_CLIENT_ID', 'test-gdrive-client-id');
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it('includes the GDrive option with ready:false when registeredIds is empty', async () => {
        const { getAvailableProviders } = await import('./index');
        const options = getAvailableProviders(new Set());
        expect(options).toHaveLength(2);
        expect(options[1].providerId).toBe('GDRIVE');
        expect(options[1].ready).toBe(false);
    });

    it('includes the GDrive option with ready:true when GDRIVE is in registeredIds', async () => {
        const { getAvailableProviders } = await import('./index');
        const options = getAvailableProviders(new Set(['GDRIVE']));
        expect(options[1].providerId).toBe('GDRIVE');
        expect(options[1].ready).toBe(true);
    });

    it('includes the GDrive option with ready:true after successful registration', async () => {
        const { getAvailableProviders, allProvidersReady } = await import('./index');
        const registeredIds = await allProvidersReady;
        const options = getAvailableProviders(registeredIds);
        expect(options[1].providerId).toBe('GDRIVE');
        expect(options[1].ready).toBe(true);
    });

    it('GDrive option has inFlightLabel "Connecting…"', async () => {
        const { getAvailableProviders } = await import('./index');
        const [, gdriveOption] = getAvailableProviders(new Set(['GDRIVE']));
        expect(gdriveOption.inFlightLabel).toBe('Connecting…');
    });
});
