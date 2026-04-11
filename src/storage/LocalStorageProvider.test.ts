import { LocalStorageProvider } from './LocalStorageProvider';
import { STORAGE_KEY_PREFIX } from './types';


const ID = 'test-project-id';
const KEY = `${STORAGE_KEY_PREFIX}${ID}`;

/** New storage format: { meta: { name, lastModified }, data: { ...AppData } } */
const BASE_RECORD = {
    meta: {
        name: 'My Project',
        lastModified: '2024-01-01T00:00:00.000Z'
    },
    data: {
        notes: [],
        tasks: [],
        expenses: [],
        calendarEvents: [],
        budget: 0
    }
};

describe('LocalStorageProvider', () => {
    let provider: LocalStorageProvider;

    beforeEach(() => {
        localStorage.clear();
        provider = new LocalStorageProvider();
    });

    afterEach(() => {
        localStorage.clear();
    });

    // ── listProjects ─────────────────────────────────────────────────────────

    describe('listProjects', () => {
        it('returns empty array when no projects exist', async () => {
            expect(await provider.listProjects()).toEqual([]);
        });

        it('returns a project that has the prefix key', async () => {
            localStorage.setItem(KEY, JSON.stringify(BASE_RECORD));
            const list = await provider.listProjects();
            expect(list).toHaveLength(1);
            expect(list[0]).toMatchObject({ id: ID, name: 'My Project' });
        });

        it('skips keys that do not start with the prefix', async () => {
            localStorage.setItem('renovation-data', JSON.stringify(BASE_RECORD));
            localStorage.setItem('unrelated-key', 'value');
            expect(await provider.listProjects()).toHaveLength(0);
        });

        it('skips entries that lack a valid name', async () => {
            localStorage.setItem(KEY, JSON.stringify({ meta: { lastModified: '2024-01-01T00:00:00.000Z' }, data: {} }));
            expect(await provider.listProjects()).toHaveLength(0);
        });

        it('skips entries with missing lastModified', async () => {
            localStorage.setItem(KEY, JSON.stringify({ meta: { name: 'ok' }, data: {} }));
            expect(await provider.listProjects()).toHaveLength(0);
        });

        it('skips entries with non-string lastModified', async () => {
            localStorage.setItem(KEY, JSON.stringify({ meta: { name: 'ok', lastModified: 12345 }, data: {} }));
            expect(await provider.listProjects()).toHaveLength(0);
        });

        it('skips entries with invalid JSON', async () => {
            localStorage.setItem(KEY, 'not-json');
            expect(await provider.listProjects()).toHaveLength(0);
        });

        it('sorts projects by lastModified descending', async () => {
            const id1 = 'p1';
            const id2 = 'p2';
            localStorage.setItem(
                `${STORAGE_KEY_PREFIX}${id1}`,
                JSON.stringify({ meta: { name: 'P1', lastModified: '2024-01-01T00:00:00.000Z' }, data: {} })
            );
            localStorage.setItem(
                `${STORAGE_KEY_PREFIX}${id2}`,
                JSON.stringify({ meta: { name: 'P2', lastModified: '2024-06-01T00:00:00.000Z' }, data: {} })
            );
            const list = await provider.listProjects();
            expect(list[0].id).toBe(id2);
            expect(list[1].id).toBe(id1);
        });
    });

    // ── loadProject ──────────────────────────────────────────────────────────

    describe('loadProject', () => {
        it('returns null when the project does not exist', async () => {
            expect(await provider.loadProject('nonexistent')).toBeNull();
        });

        it('returns null for invalid JSON', async () => {
            localStorage.setItem(KEY, 'bad-json');
            expect(await provider.loadProject(ID)).toBeNull();
        });

        it('returns null when parsed record has no string name', async () => {
            localStorage.setItem(KEY, JSON.stringify({ meta: { name: 42, lastModified: '2024-01-01T00:00:00.000Z' }, data: {} }));
            expect(await provider.loadProject(ID)).toBeNull();
        });

        it('returns null when lastModified is missing', async () => {
            localStorage.setItem(KEY, JSON.stringify({ meta: { name: 'ok' }, data: {} }));
            expect(await provider.loadProject(ID)).toBeNull();
        });

        it('returns meta and rawData for a valid project', async () => {
            localStorage.setItem(KEY, JSON.stringify(BASE_RECORD));
            const result = await provider.loadProject(ID);
            expect(result).not.toBeNull();
            expect(result!.meta).toMatchObject({ id: ID, name: 'My Project' });
            expect(result!.rawData).toMatchObject({ notes: [], budget: 0 });
        });
    });

    // ── createProject ────────────────────────────────────────────────────────

    describe('createProject', () => {
        it('stores a new project and returns a UUID-like id', async () => {
            const id = await provider.createProject('New Project');
            expect(typeof id).toBe('string');
            expect(id.length).toBeGreaterThan(0);

            const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${id}`);
            expect(raw).not.toBeNull();

            const parsed = JSON.parse(raw!) as { meta: { name: string }; data: { budget: number } };
            expect(parsed.meta.name).toBe('New Project');
            expect(parsed.data.budget).toBe(0);
        });

        it('stores a project with empty default app data', async () => {
            const id = await provider.createProject('Empty');
            const parsed = JSON.parse(localStorage.getItem(`${STORAGE_KEY_PREFIX}${id}`)!) as {
                data: {
                    notes: unknown[];
                    tasks: unknown[];
                    expenses: unknown[];
                    calendarEvents: unknown[];
                };
            };
            expect(parsed.data.notes).toEqual([]);
            expect(parsed.data.tasks).toEqual([]);
            expect(parsed.data.expenses).toEqual([]);
            expect(parsed.data.calendarEvents).toEqual([]);
        });
    });

    // ── saveProject ──────────────────────────────────────────────────────────

    describe('saveProject', () => {
        it('writes the project to localStorage with the correct key', async () => {
            await provider.saveProject(ID, 'Saved Project', {
                notes: [],
                tasks: [],
                expenses: [],
                calendarEvents: [],
                budget: 9999
            });

            const raw = localStorage.getItem(KEY);
            expect(raw).not.toBeNull();
            const parsed = JSON.parse(raw!) as { meta: { name: string }; data: { budget: number } };
            expect(parsed.meta.name).toBe('Saved Project');
            expect(parsed.data.budget).toBe(9999);
        });

        it('updates lastModified to current ISO time on save', async () => {
            const before = new Date().toISOString();
            await provider.saveProject(ID, 'Project', {
                notes: [],
                tasks: [],
                expenses: [],
                calendarEvents: [],
                budget: 0
            });
            const after = new Date().toISOString();
            const parsed = JSON.parse(localStorage.getItem(KEY)!) as { meta: { lastModified: string } };
            expect(parsed.meta.lastModified >= before).toBe(true);
            expect(parsed.meta.lastModified <= after).toBe(true);
        });
    });

    // ── renameProject ────────────────────────────────────────────────────────

    describe('renameProject', () => {
        it('updates the name in localStorage', async () => {
            localStorage.setItem(KEY, JSON.stringify(BASE_RECORD));
            await provider.renameProject(ID, 'Renamed');
            const parsed = JSON.parse(localStorage.getItem(KEY)!) as { meta: { name: string } };
            expect(parsed.meta.name).toBe('Renamed');
        });

        it('does nothing when the project does not exist', async () => {
            await expect(provider.renameProject('ghost', 'New Name')).resolves.toBeUndefined();
        });

        it('does nothing when the stored entry has invalid JSON', async () => {
            localStorage.setItem(KEY, 'bad-json{');
            await expect(provider.renameProject(ID, 'New Name')).resolves.toBeUndefined();
        });
    });

    // ── getProjectSize ───────────────────────────────────────────────────────

    describe('getProjectSize', () => {
        it('returns 0 when the project does not exist', async () => {
            expect(await provider.getProjectSize('nonexistent')).toBe(0);
        });

        it('returns the byte length of the stored JSON', async () => {
            localStorage.setItem(KEY, JSON.stringify(BASE_RECORD));
            const size = await provider.getProjectSize(ID);
            expect(size).toBeGreaterThan(0);
            // Rough sanity check
            expect(size).toBe(new TextEncoder().encode(localStorage.getItem(KEY)!).length);
        });
    });

    // ── initialize ───────────────────────────────────────────────────────────

    describe('initialize', () => {
        it('is a no-op in localStorage mode', async () => {
            await expect(provider.initialize()).resolves.toBeUndefined();
        });
    });

    // ── renameProject extra branch ───────────────────────────────────────────

    describe('renameProject (extra branches)', () => {
        it('does nothing when the stored entry is valid JSON but not a StoredProjectRecord', async () => {
            localStorage.setItem(KEY, JSON.stringify({ foo: 'bar' }));
            await provider.renameProject(ID, 'New Name');
            // Record should be left unchanged
            const stored = JSON.parse(localStorage.getItem(KEY)!) as { foo: string };
            expect(stored.foo).toBe('bar');
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// OPFS mode tests
// ─────────────────────────────────────────────────────────────────────────────

function makeMockFileHandle(initialContent = '') {
    const state = { content: initialContent };
    return {
        kind: 'file' as const,
        state,
        getFile: vi.fn(async () => ({
            text: async () => state.content,
            size: new TextEncoder().encode(state.content).length
        })),
        createWritable: vi.fn(async () => ({
            write: vi.fn(async (data: string) => {
                state.content = data;
            }),
            close: vi.fn(async () => {
            })
        }))
    };
}

type MockFileHandle = ReturnType<typeof makeMockFileHandle>;

function makeMockDirHandle(initialFiles: Record<string, string> = {}) {
    const fileMap = new Map<string, MockFileHandle>(
        Object.entries(initialFiles).map(([k, v]) => [k, makeMockFileHandle(v)])
    );

    const dirHandle = {
        requestPermission: vi.fn(async (_opts: unknown) => 'granted' as PermissionState),
        getFileHandle: vi.fn(async (name: string, opts?: { create?: boolean }) => {
            if (fileMap.has(name)) {
                return fileMap.get(name)!;
            }
            if (opts?.create) {
                const h = makeMockFileHandle('');
                fileMap.set(name, h);
                return h;
            }
            throw Object.assign(new Error(`File not found: ${name}`), { name: 'NotFoundError' });
        }),
        async* [Symbol.asyncIterator]() {
            for (const entry of fileMap) {
                yield entry;
            }
        }
    };

    return { dirHandle, fileMap };
}

function setupOPFS(dirHandle: unknown) {
    Object.defineProperty(globalThis.navigator, 'storage', {
        value: { getDirectory: vi.fn(async () => dirHandle) },
        configurable: true,
        writable: true
    });
}

function teardownOPFS() {
    Object.defineProperty(globalThis.navigator, 'storage', {
        value: undefined,
        configurable: true,
        writable: true
    });
}

describe('LocalStorageProvider – OPFS mode', () => {
    let opfsProvider: LocalStorageProvider;
    let mockFileMap: Map<string, MockFileHandle>;

    beforeEach(() => {
        localStorage.clear();
        const { dirHandle, fileMap } = makeMockDirHandle();
        mockFileMap = fileMap;
        setupOPFS(dirHandle);
        opfsProvider = new LocalStorageProvider();
    });

    afterEach(() => {
        teardownOPFS();
        localStorage.clear();
    });

    // ── label ─────────────────────────────────────────────────────────────────

    it('label returns "Local Storage (OPFS)" when OPFS is available', () => {
        expect(opfsProvider.label).toBe('Local Storage (OPFS)');
    });

    // ── createProject ─────────────────────────────────────────────────────────

    it('createProject saves to OPFS and localStorage', async () => {
        const id = await opfsProvider.createProject('OPFS Project');

        // localStorage backup
        const lsRaw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${id}`);
        expect(lsRaw).not.toBeNull();
        const lsParsed = JSON.parse(lsRaw!) as { meta: { name: string } };
        expect(lsParsed.meta.name).toBe('OPFS Project');

        // OPFS file
        expect(mockFileMap.has(`${STORAGE_KEY_PREFIX}${id}`)).toBe(true);
        const opfsContent = mockFileMap.get(`${STORAGE_KEY_PREFIX}${id}`)!.state.content;
        const opfsParsed = JSON.parse(opfsContent) as { meta: { name: string } };
        expect(opfsParsed.meta.name).toBe('OPFS Project');
    });

    // ── getProjectSize ────────────────────────────────────────────────────────

    it('getProjectSize returns OPFS file byte size', async () => {
        const record = JSON.stringify(BASE_RECORD);
        const fileKey = `${STORAGE_KEY_PREFIX}${ID}`;
        const { dirHandle, fileMap } = makeMockDirHandle({ [fileKey]: record });
        setupOPFS(dirHandle);
        const p = new LocalStorageProvider();

        const size = await p.getProjectSize(ID);
        expect(size).toBe(fileMap.get(fileKey)!.state.content.length);
    });

    it('getProjectSize falls back to localStorage when OPFS file is missing', async () => {
        // opfsProvider has empty OPFS – getFileHandle will throw (no create)
        localStorage.setItem(KEY, JSON.stringify(BASE_RECORD));
        const size = await opfsProvider.getProjectSize(ID);
        // Falls back to localStorage byte size
        expect(size).toBe(new TextEncoder().encode(JSON.stringify(BASE_RECORD)).length);
    });

    // ── listProjects ──────────────────────────────────────────────────────────

    it('listProjects returns projects from OPFS', async () => {
        const record = JSON.stringify(BASE_RECORD);
        const { dirHandle } = makeMockDirHandle({ [`${STORAGE_KEY_PREFIX}${ID}`]: record });
        setupOPFS(dirHandle);
        const p = new LocalStorageProvider();

        const list = await p.listProjects();
        expect(list).toHaveLength(1);
        expect(list[0]).toMatchObject({ id: ID, name: 'My Project' });
    });

    it('listProjects skips OPFS entries with valid JSON but invalid StoredProjectRecord shape', async () => {
        const { dirHandle } = makeMockDirHandle({ [`${STORAGE_KEY_PREFIX}${ID}`]: JSON.stringify({ invalid: true }) });
        setupOPFS(dirHandle);
        const p = new LocalStorageProvider();

        expect(await p.listProjects()).toHaveLength(0);
    });

    it('listProjects falls back to localStorage when OPFS iteration throws', async () => {
        const record = JSON.stringify(BASE_RECORD);
        localStorage.setItem(KEY, record);

        const { dirHandle } = makeMockDirHandle();
        // override async iterator to throw
        (dirHandle as unknown as { [Symbol.asyncIterator]: () => AsyncIterator<unknown> })[Symbol.asyncIterator] = function iteratorThatThrows() {
            return {
                next: async () => {
                    throw new Error('OPFS iteration failure');
                }
            };
        };
        setupOPFS(dirHandle);
        const p = new LocalStorageProvider();

        const list = await p.listProjects();
        // fell back to LS
        expect(list).toHaveLength(1);
        expect(list[0]).toMatchObject({ id: ID, name: 'My Project' });
    });

    // ── loadProject ───────────────────────────────────────────────────────────

    it('loadProject reads from OPFS', async () => {
        const record = JSON.stringify(BASE_RECORD);
        const { dirHandle } = makeMockDirHandle({ [`${STORAGE_KEY_PREFIX}${ID}`]: record });
        setupOPFS(dirHandle);
        const p = new LocalStorageProvider();

        const result = await p.loadProject(ID);
        expect(result).not.toBeNull();
        expect(result!.meta).toMatchObject({ id: ID, name: 'My Project' });
        expect(result!.rawData).toMatchObject({ budget: 0 });
    });

    it('loadProject falls back to localStorage when OPFS read throws', async () => {
        localStorage.setItem(KEY, JSON.stringify(BASE_RECORD));
        // OPFS has no file for ID → getFileHandle throws → falls back to LS
        const result = await opfsProvider.loadProject(ID);
        expect(result).not.toBeNull();
        expect(result!.meta).toMatchObject({ id: ID, name: 'My Project' });
    });

    // ── renameProject ─────────────────────────────────────────────────────────

    it('renameProject updates name in OPFS and writes LS backup', async () => {
        const record = JSON.stringify(BASE_RECORD);
        const fileKey = `${STORAGE_KEY_PREFIX}${ID}`;
        const { dirHandle, fileMap } = makeMockDirHandle({ [fileKey]: record });
        setupOPFS(dirHandle);
        const p = new LocalStorageProvider();

        await p.renameProject(ID, 'Renamed OPFS');

        // localStorage updated
        const lsParsed = JSON.parse(localStorage.getItem(KEY)!) as { meta: { name: string } };
        expect(lsParsed.meta.name).toBe('Renamed OPFS');

        // OPFS updated
        const opfsParsed = JSON.parse(fileMap.get(fileKey)!.state.content) as { meta: { name: string } };
        expect(opfsParsed.meta.name).toBe('Renamed OPFS');
    });

    it('renameProject falls back to LS-only path when OPFS read throws', async () => {
        // No OPFS file; LS has the record
        localStorage.setItem(KEY, JSON.stringify(BASE_RECORD));

        await opfsProvider.renameProject(ID, 'LS Fallback');

        const lsParsed = JSON.parse(localStorage.getItem(KEY)!) as { meta: { name: string } };
        expect(lsParsed.meta.name).toBe('LS Fallback');
    });

    // ── saveProject ───────────────────────────────────────────────────────────

    it('saveProject saves to OPFS and localStorage', async () => {
        await opfsProvider.saveProject(ID, 'Saved', { notes: [], tasks: [], expenses: [], calendarEvents: [], budget: 77 });

        const lsParsed = JSON.parse(localStorage.getItem(KEY)!) as { meta: { name: string }; data: { budget: number } };
        expect(lsParsed.meta.name).toBe('Saved');
        expect(lsParsed.data.budget).toBe(77);

        const opfsContent = mockFileMap.get(`${STORAGE_KEY_PREFIX}${ID}`)!.state.content;
        const opfsParsed = JSON.parse(opfsContent) as { data: { budget: number } };
        expect(opfsParsed.data.budget).toBe(77);
    });

    it('saveProject falls back to localStorage when OPFS write throws', async () => {
        // Make createWritable throw to simulate OPFS write failure
        const { dirHandle } = makeMockDirHandle();
        dirHandle.getFileHandle = vi.fn(async () => ({
            kind: 'file' as const,
            state: { content: '' },
            getFile: vi.fn(),
            createWritable: vi.fn(async () => {
                throw new Error('write failure');
            })
        }));
        setupOPFS(dirHandle);
        const p = new LocalStorageProvider();

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        });
        await p.saveProject(ID, 'Fallback', { notes: [], tasks: [], expenses: [], calendarEvents: [], budget: 1 });
        errorSpy.mockRestore();

        // LS should still be written
        const lsParsed = JSON.parse(localStorage.getItem(KEY)!) as { meta: { name: string } };
        expect(lsParsed.meta.name).toBe('Fallback');
        // Provider fell back to LS mode
        expect(p.label).toBe('Local Storage');
    });

    // ── initialize ────────────────────────────────────────────────────────────

    it('initialize – permission request error falls back to localStorage mode', async () => {
        const { dirHandle } = makeMockDirHandle();
        dirHandle.requestPermission.mockRejectedValue(new Error('Permission denied'));
        setupOPFS(dirHandle);
        const p = new LocalStorageProvider();

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        });
        await p.initialize();
        errorSpy.mockRestore();

        expect(p.label).toBe('Local Storage');
    });

    it('initialize – OPFS iteration failure falls back to localStorage mode', async () => {
        const { dirHandle } = makeMockDirHandle();
        // Make the iteration (second getDirectory call) work for permissions, but fail on iteration
        let callCount = 0;
        const origGetDirectory = dirHandle;
        const brokenDir = {
            ...dirHandle,
            requestPermission: dirHandle.requestPermission,
            getFileHandle: dirHandle.getFileHandle,
            [Symbol.asyncIterator]() {
                return {
                    next: async () => {
                        throw new Error('iteration broken');
                    }
                };
            }
        };
        const getDirectory = vi.fn(async () => {
            callCount++;
            // first call: permissions check → real dir (with requestPermission)
            // second call: iteration → broken dir
            return callCount === 1 ? origGetDirectory : brokenDir;
        });
        Object.defineProperty(globalThis.navigator, 'storage', {
            value: { getDirectory },
            configurable: true,
            writable: true
        });
        const p = new LocalStorageProvider();

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        });
        await p.initialize();
        errorSpy.mockRestore();

        expect(p.label).toBe('Local Storage');
    });

    it('initialize – syncs OPFS → LS when OPFS is newer', async () => {
        const opfsRecord = JSON.stringify({
            ...BASE_RECORD,
            meta: { ...BASE_RECORD.meta, lastModified: '2024-06-01T00:00:00.000Z' }
        });
        const lsRecord = JSON.stringify({
            ...BASE_RECORD,
            meta: { ...BASE_RECORD.meta, lastModified: '2024-01-01T00:00:00.000Z' }
        });
        const fileKey = `${STORAGE_KEY_PREFIX}${ID}`;
        localStorage.setItem(KEY, lsRecord);

        const { dirHandle } = makeMockDirHandle({ [fileKey]: opfsRecord });
        setupOPFS(dirHandle);
        const p = new LocalStorageProvider();

        await p.initialize();

        const lsParsed = JSON.parse(localStorage.getItem(KEY)!) as { meta: { lastModified: string } };
        expect(lsParsed.meta.lastModified).toBe('2024-06-01T00:00:00.000Z');
    });

    it('initialize – syncs LS → OPFS when LS is newer', async () => {
        const opfsRecord = JSON.stringify({
            ...BASE_RECORD,
            meta: { ...BASE_RECORD.meta, lastModified: '2024-01-01T00:00:00.000Z' }
        });
        const lsRecord = JSON.stringify({
            ...BASE_RECORD,
            meta: { ...BASE_RECORD.meta, lastModified: '2024-06-01T00:00:00.000Z' }
        });
        const fileKey = `${STORAGE_KEY_PREFIX}${ID}`;
        localStorage.setItem(KEY, lsRecord);

        const { dirHandle, fileMap } = makeMockDirHandle({ [fileKey]: opfsRecord });
        setupOPFS(dirHandle);
        const p = new LocalStorageProvider();

        await p.initialize();

        const opfsParsed = JSON.parse(fileMap.get(fileKey)!.state.content) as { meta: { lastModified: string } };
        expect(opfsParsed.meta.lastModified).toBe('2024-06-01T00:00:00.000Z');
    });

    it('initialize – copies OPFS-only record to LS when LS entry is absent', async () => {
        const opfsRecord = JSON.stringify(BASE_RECORD);
        const fileKey = `${STORAGE_KEY_PREFIX}${ID}`;

        const { dirHandle } = makeMockDirHandle({ [fileKey]: opfsRecord });
        setupOPFS(dirHandle);
        const p = new LocalStorageProvider();

        await p.initialize();

        const lsParsed = JSON.parse(localStorage.getItem(KEY)!) as { meta: { name: string } };
        expect(lsParsed.meta.name).toBe('My Project');
    });

    it('initialize – copies LS-only record to OPFS when OPFS entry exists but is not a valid StoredProjectRecord', async () => {
        localStorage.setItem(KEY, JSON.stringify(BASE_RECORD));
        // OPFS file exists but has valid JSON that doesn't match StoredProjectRecord shape
        const fileKey = `${STORAGE_KEY_PREFIX}${ID}`;
        const { dirHandle, fileMap } = makeMockDirHandle({ [fileKey]: JSON.stringify({ invalid: true }) });
        setupOPFS(dirHandle);
        const p = new LocalStorageProvider();

        await p.initialize();

        const opfsParsed = JSON.parse(fileMap.get(fileKey)!.state.content) as { meta: { name: string } };
        expect(opfsParsed.meta.name).toBe('My Project');
    });

    it('initialize – warns and skips when both OPFS and LS entries are invalid StoredProjectRecord shape', async () => {
        // LS has valid JSON but not a StoredProjectRecord shape
        localStorage.setItem(KEY, JSON.stringify({ invalid: true }));
        // OPFS also has valid JSON but not a StoredProjectRecord shape
        const fileKey = `${STORAGE_KEY_PREFIX}${ID}`;
        const { dirHandle } = makeMockDirHandle({ [fileKey]: JSON.stringify({ bad: 'data' }) });
        setupOPFS(dirHandle);
        const p = new LocalStorageProvider();

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        });
        await p.initialize();
        warnSpy.mockRestore();

        // Provider should still be in OPFS mode (initialization completed)
        expect(p.label).toBe('Local Storage (OPFS)');
    });

    it('initialize – logs error and continues when per-project sync throws', async () => {
        // LS has a valid record, OPFS has a file where getFile throws → caught per-project
        localStorage.setItem(KEY, JSON.stringify(BASE_RECORD));
        const fileKey = `${STORAGE_KEY_PREFIX}${ID}`;
        const { dirHandle } = makeMockDirHandle();
        // Pre-populate the file in the map so iteration yields it, but make getFile throw
        dirHandle.getFileHandle = vi.fn(async (_name: string, _opts?: { create?: boolean }) => ({
            kind: 'file' as const,
            state: { content: '' },
            getFile: vi.fn(async () => {
                throw new Error('file read error');
            }),
            createWritable: vi.fn()
        }));
        setupOPFS({
            ...dirHandle,
            [Symbol.asyncIterator]: async function* asyncIter() {
                yield [fileKey, { kind: 'file' }];
            }
        });
        const p = new LocalStorageProvider();

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        });
        await p.initialize();
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining(ID),
            expect.any(Error)
        );
        errorSpy.mockRestore();
    });

    // ── readFromOPFS: empty / corrupted file handling ────────────────────────

    it('initialize – copies LS-only record to OPFS when OPFS file is empty (new empty file)', async () => {
        localStorage.setItem(KEY, JSON.stringify(BASE_RECORD));
        // OPFS file exists but is empty (newly created)
        const fileKey = `${STORAGE_KEY_PREFIX}${ID}`;
        const { dirHandle, fileMap } = makeMockDirHandle({ [fileKey]: '' });
        setupOPFS(dirHandle);
        const p = new LocalStorageProvider();

        await p.initialize();

        // LS record should have been written to the empty OPFS file
        const opfsParsed = JSON.parse(fileMap.get(fileKey)!.state.content) as { meta: { name: string } };
        expect(opfsParsed.meta.name).toBe('My Project');
    });

    it('listProjects – skips OPFS entries with empty file content', async () => {
        const fileKey = `${STORAGE_KEY_PREFIX}${ID}`;
        // OPFS file is empty
        const { dirHandle } = makeMockDirHandle({ [fileKey]: '' });
        setupOPFS(dirHandle);
        const p = new LocalStorageProvider();

        const list = await p.listProjects();
        expect(list).toHaveLength(0);
    });

    it('listProjects – skips OPFS entries with malformed JSON', async () => {
        const fileKey = `${STORAGE_KEY_PREFIX}${ID}`;
        const { dirHandle } = makeMockDirHandle({ [fileKey]: 'not-valid-json{{' });
        setupOPFS(dirHandle);
        const p = new LocalStorageProvider();

        const list = await p.listProjects();
        expect(list).toHaveLength(0);
    });
});
