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
});
