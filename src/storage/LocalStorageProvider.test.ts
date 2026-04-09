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
});
