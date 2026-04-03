import { LocalStorageProvider } from './LocalStorageProvider';
import { STORAGE_KEY_PREFIX } from './types';


const ID = 'test-project-id';
const KEY = `${STORAGE_KEY_PREFIX}${ID}`;

const BASE_RECORD = {
    name: 'My Project',
    lastModified: '2024-01-01T00:00:00.000Z',
    notes: [],
    tasks: [],
    expenses: [],
    calendarEvents: [],
    budget: 0
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
        it('returns empty array when no projects exist', () => {
            expect(provider.listProjects()).toEqual([]);
        });

        it('returns a project that has the prefix key', () => {
            localStorage.setItem(KEY, JSON.stringify(BASE_RECORD));
            const list = provider.listProjects();
            expect(list).toHaveLength(1);
            expect(list[0]).toMatchObject({ id: ID, name: 'My Project' });
        });

        it('skips keys that do not start with the prefix', () => {
            localStorage.setItem('renovation-data', JSON.stringify(BASE_RECORD));
            localStorage.setItem('unrelated-key', 'value');
            expect(provider.listProjects()).toHaveLength(0);
        });

        it('skips entries that lack a valid name', () => {
            localStorage.setItem(KEY, JSON.stringify({ lastModified: '2024-01-01T00:00:00.000Z' })); // no name
            expect(provider.listProjects()).toHaveLength(0);
        });

        it('accepts entries missing lastModified, using epoch as fallback', () => {
            localStorage.setItem(KEY, JSON.stringify({ name: 'ok' })); // no lastModified
            const list = provider.listProjects();
            expect(list).toHaveLength(1);
            expect(list[0].name).toBe('ok');
            expect(list[0].lastModified).toBe(new Date(0).toISOString());
        });

        it('accepts entries with non-string lastModified, using epoch as fallback', () => {
            localStorage.setItem(KEY, JSON.stringify({ name: 'ok', lastModified: 12345 }));
            const list = provider.listProjects();
            expect(list).toHaveLength(1);
            expect(list[0].lastModified).toBe(new Date(0).toISOString());
        });

        it('skips entries with invalid JSON', () => {
            localStorage.setItem(KEY, 'not-json');
            expect(provider.listProjects()).toHaveLength(0);
        });

        it('sorts projects by lastModified descending', () => {
            const id1 = 'p1';
            const id2 = 'p2';
            localStorage.setItem(
                `${STORAGE_KEY_PREFIX}${id1}`,
                JSON.stringify({ ...BASE_RECORD, lastModified: '2024-01-01T00:00:00.000Z' })
            );
            localStorage.setItem(
                `${STORAGE_KEY_PREFIX}${id2}`,
                JSON.stringify({ ...BASE_RECORD, lastModified: '2024-06-01T00:00:00.000Z' })
            );
            const list = provider.listProjects();
            expect(list[0].id).toBe(id2);
            expect(list[1].id).toBe(id1);
        });
    });

    // ── loadProject ──────────────────────────────────────────────────────────

    describe('loadProject', () => {
        it('returns null when the project does not exist', () => {
            expect(provider.loadProject('nonexistent')).toBeNull();
        });

        it('returns null for invalid JSON', () => {
            localStorage.setItem(KEY, 'bad-json');
            expect(provider.loadProject(ID)).toBeNull();
        });

        it('returns null when parsed record has no string name', () => {
            localStorage.setItem(KEY, JSON.stringify({ name: 42, lastModified: '2024-01-01T00:00:00.000Z' }));
            expect(provider.loadProject(ID)).toBeNull();
        });

        it('returns meta and rawData for a valid project', () => {
            localStorage.setItem(KEY, JSON.stringify(BASE_RECORD));
            const result = provider.loadProject(ID);
            expect(result).not.toBeNull();
            expect(result!.meta).toMatchObject({ id: ID, name: 'My Project' });
            expect(result!.rawData).toMatchObject({ notes: [], budget: 0 });
        });

        it('falls back to current time when lastModified is missing', () => {
            const { lastModified: _lm, ...withoutLM } = BASE_RECORD;
            localStorage.setItem(KEY, JSON.stringify(withoutLM));
            const result = provider.loadProject(ID);
            expect(result).not.toBeNull();
            expect(typeof result!.meta.lastModified).toBe('string');
        });
    });

    // ── createProject ────────────────────────────────────────────────────────

    describe('createProject', () => {
        it('stores a new project and returns a UUID-like id', () => {
            const id = provider.createProject('New Project');
            expect(typeof id).toBe('string');
            expect(id.length).toBeGreaterThan(0);

            const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${id}`);
            expect(raw).not.toBeNull();

            const parsed = JSON.parse(raw!) as { name: string; budget: number };
            expect(parsed.name).toBe('New Project');
            expect(parsed.budget).toBe(0);
        });

        it('stores a project with empty default app data', () => {
            const id = provider.createProject('Empty');
            const parsed = JSON.parse(localStorage.getItem(`${STORAGE_KEY_PREFIX}${id}`)!) as {
                notes: unknown[];
                tasks: unknown[];
                expenses: unknown[];
                calendarEvents: unknown[];
            };
            expect(parsed.notes).toEqual([]);
            expect(parsed.tasks).toEqual([]);
            expect(parsed.expenses).toEqual([]);
            expect(parsed.calendarEvents).toEqual([]);
        });
    });

    // ── saveProject ──────────────────────────────────────────────────────────

    describe('saveProject', () => {
        it('writes the project to localStorage with the correct key', () => {
            provider.saveProject(ID, 'Saved Project', {
                notes: [],
                tasks: [],
                expenses: [],
                calendarEvents: [],
                budget: 9999
            });

            const raw = localStorage.getItem(KEY);
            expect(raw).not.toBeNull();
            const parsed = JSON.parse(raw!) as { name: string; budget: number };
            expect(parsed.name).toBe('Saved Project');
            expect(parsed.budget).toBe(9999);
        });

        it('updates lastModified to current ISO time on save', () => {
            const before = new Date().toISOString();
            provider.saveProject(ID, 'Project', {
                notes: [],
                tasks: [],
                expenses: [],
                calendarEvents: [],
                budget: 0
            });
            const after = new Date().toISOString();
            const parsed = JSON.parse(localStorage.getItem(KEY)!) as { lastModified: string };
            expect(parsed.lastModified >= before).toBe(true);
            expect(parsed.lastModified <= after).toBe(true);
        });
    });

    // ── renameProject ────────────────────────────────────────────────────────

    describe('renameProject', () => {
        it('updates the name in localStorage', () => {
            localStorage.setItem(KEY, JSON.stringify(BASE_RECORD));
            provider.renameProject(ID, 'Renamed');
            const parsed = JSON.parse(localStorage.getItem(KEY)!) as { name: string };
            expect(parsed.name).toBe('Renamed');
        });

        it('does nothing when the project does not exist', () => {
            expect(() => provider.renameProject('ghost', 'New Name')).not.toThrow();
        });

        it('does nothing when the stored entry has invalid JSON', () => {
            localStorage.setItem(KEY, 'bad-json{');
            expect(() => provider.renameProject(ID, 'New Name')).not.toThrow();
        });
    });

    // ── getProjectSize ───────────────────────────────────────────────────────

    describe('getProjectSize', () => {
        it('returns 0 when the project does not exist', () => {
            expect(provider.getProjectSize('nonexistent')).toBe(0);
        });

        it('returns the byte length of the stored JSON', () => {
            localStorage.setItem(KEY, JSON.stringify(BASE_RECORD));
            const size = provider.getProjectSize(ID);
            expect(size).toBeGreaterThan(0);
            // Rough sanity check
            expect(size).toBe(new TextEncoder().encode(localStorage.getItem(KEY)!).length);
        });
    });
});
