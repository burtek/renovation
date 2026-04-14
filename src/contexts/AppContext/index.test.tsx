import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { storageManager } from '../../storage';
import { ACTIVE_PROJECT_KEY, LEGACY_DATA_KEY, STORAGE_KEY_PREFIX } from '../../storage/types';
import type { AppData, CalendarEvent, Expense, Note, Subtask, Task } from '../../types';
import { isCompressionSupported } from '../../utils/compression';

import { AppProvider, useApp } from '.';


// ---------------------------------------------------------------------------
// Determine if Blob.stream() is available for gz loading tests
// ---------------------------------------------------------------------------

const blobStreamSupported = isCompressionSupported && typeof new Blob().stream === 'function';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INITIAL_EMPTY: AppData = {
    notes: [],
    tasks: [],
    expenses: [],
    calendarEvents: [],
    budget: 0
};

const TEST_PROJECT_ID = 'test-project-id';

function preloadState(state: Partial<AppData>) {
    localStorage.setItem(
        `${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`,
        JSON.stringify({
            meta: { name: 'Test Project', lastModified: '2024-01-01T00:00:00.000Z' },
            data: { ...INITIAL_EMPTY, ...state }
        })
    );
    localStorage.setItem(ACTIVE_PROJECT_KEY, TEST_PROJECT_ID);
}

function wrapper({ children }: { children: ReactNode }) {
    return <AppProvider>{children}</AppProvider>;
}

function makeNote(overrides: Partial<Note> = {}): Note {
    return {
        id: 'n1',
        title: 'Test Note',
        content: 'Content',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        ...overrides
    };
}

function makeTask(overrides: Partial<Task> = {}): Task {
    return {
        id: 't1',
        title: 'Task',
        notes: '',
        startDate: '2024-01-01',
        endDate: '2024-01-10',
        assignee: '',
        dependsOn: [],
        completed: false,
        subtasks: [],
        ...overrides
    };
}

function makeSubtask(overrides: Partial<Subtask> = {}): Subtask {
    return {
        id: 's1',
        parentId: 't1',
        title: 'Subtask',
        notes: '',
        completed: false,
        ...overrides
    };
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
    return {
        id: 'e1',
        description: 'Paint',
        date: '2024-01-01',
        price: 100,
        shopName: '',
        invoiceNo: '',
        invoiceForm: 'paper',
        loanApproved: false,
        ...overrides
    };
}

function makeCalendarEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
    return {
        id: 'ev1',
        title: 'Meeting',
        date: '2024-01-01',
        eventType: 'event',
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// localStorage integration
// ---------------------------------------------------------------------------

describe('AppContext – localStorage', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
        vi.unstubAllGlobals();
    });

    it('loads valid stored data on mount', () => {
        preloadState({ budget: 9999 });
        const { result } = renderHook(() => useApp(), { wrapper });
        expect(result.current.state.budget).toBe(9999);
    });

    it('falls back to empty state on invalid JSON in legacy key', () => {
        localStorage.setItem(LEGACY_DATA_KEY, 'not-json{{{{');
        const { result } = renderHook(() => useApp(), { wrapper });
        expect(result.current.state.budget).toBe(0);
        expect(result.current.state.notes).toHaveLength(0);
    });

    it('falls back to empty state when active project key has invalid JSON', () => {
        localStorage.setItem(ACTIVE_PROJECT_KEY, TEST_PROJECT_ID);
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`, 'not-valid-json{{{{');
        const { result } = renderHook(() => useApp(), { wrapper });
        expect(result.current.state.budget).toBe(0);
    });

    it('falls back to empty state when active project record lacks meta/data fields', () => {
        localStorage.setItem(ACTIVE_PROJECT_KEY, TEST_PROJECT_ID);
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`, JSON.stringify({ foo: 'bar' }));
        const { result } = renderHook(() => useApp(), { wrapper });
        expect(result.current.state.budget).toBe(0);
    });

    it('falls back to empty state when active project meta.name is not a string', () => {
        localStorage.setItem(ACTIVE_PROJECT_KEY, TEST_PROJECT_ID);
        localStorage.setItem(
            `${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`,
            JSON.stringify({ meta: { name: 123, lastModified: '2024-01-01T00:00:00.000Z' }, data: {} })
        );
        const { result } = renderHook(() => useApp(), { wrapper });
        expect(result.current.state.budget).toBe(0);
    });

    it('persists state to localStorage after dispatch', async () => {
        preloadState({});
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.dispatch({ type: 'SET_BUDGET', payload: 12345 });
        });

        await waitFor(() => {
            const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`);
            const stored = JSON.parse(raw ?? '{}') as { data: AppData };
            expect(stored.data.budget).toBe(12345);
        });
    });
});

// ---------------------------------------------------------------------------
// useApp – outside provider
// ---------------------------------------------------------------------------

describe('useApp', () => {
    it('throws when used outside AppProvider', () => {
        // Suppress React's error boundary console output
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {
        });
        expect(() => renderHook(() => useApp())).toThrow('useApp must be used within AppProvider');
        spy.mockRestore();
    });
});

// ---------------------------------------------------------------------------
// Reducer actions (exercised through dispatch)
// ---------------------------------------------------------------------------

describe('reducer actions via dispatch', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    // ── Notes ────────────────────────────────────────────────────────────

    it('ADD_NOTE: adds a note with non-empty id, createdAt, updatedAt', () => {
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.dispatch({ type: 'ADD_NOTE', payload: { id: 'test-id', title: 'Hello', content: 'World' } });
        });

        const notes = result.current.state.notes;
        expect(notes).toHaveLength(1);
        expect(notes[0].id).toBeTruthy();
        expect(notes[0].title).toBe('Hello');
        expect(notes[0].createdAt).toBeTruthy();
        expect(notes[0].updatedAt).toBeTruthy();
    });

    it('UPDATE_NOTE: changes title and refreshes updatedAt', async () => {
        preloadState({ notes: [makeNote({ id: 'n1', title: 'Old Title' })] });
        const { result } = renderHook(() => useApp(), { wrapper });

        const original = result.current.state.notes[0];

        // Wait a tick so updatedAt will be different
        await new Promise(r => setTimeout(r, 10));

        act(() => {
            result.current.dispatch({
                type: 'UPDATE_NOTE',
                payload: { ...original, title: 'New Title' }
            });
        });

        const updated = result.current.state.notes[0];
        expect(updated.title).toBe('New Title');
        expect(updated.updatedAt).not.toBe(original.updatedAt);
    });

    it('DELETE_NOTE: removes the note, leaves others untouched', () => {
        preloadState({ notes: [makeNote({ id: 'n1', title: 'Keep' }), makeNote({ id: 'n2', title: 'Delete me' })] });
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.dispatch({ type: 'DELETE_NOTE', payload: 'n2' });
        });

        expect(result.current.state.notes).toHaveLength(1);
        expect(result.current.state.notes[0].id).toBe('n1');
    });

    // ── Tasks ────────────────────────────────────────────────────────────

    it('ADD_TASK: adds a task with non-empty id', () => {
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.dispatch({
                type: 'ADD_TASK',
                payload: { title: 'New Task', notes: '', completed: false, subtasks: [] }
            });
        });

        expect(result.current.state.tasks).toHaveLength(1);
        expect(result.current.state.tasks[0].id).toBeTruthy();
        expect(result.current.state.tasks[0].title).toBe('New Task');
    });

    it('UPDATE_TASK: changes the task title', () => {
        preloadState({ tasks: [makeTask({ id: 't1', title: 'Old' })] });
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.dispatch({
                type: 'UPDATE_TASK',
                payload: { ...result.current.state.tasks[0], title: 'Updated' }
            });
        });

        expect(result.current.state.tasks[0].title).toBe('Updated');
    });

    it('DELETE_TASK: removes the task', () => {
        preloadState({ tasks: [makeTask({ id: 't1' })] });
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.dispatch({ type: 'DELETE_TASK', payload: 't1' });
        });

        expect(result.current.state.tasks).toHaveLength(0);
    });

    it('DELETE_TASK: removes deleted task id from other tasks dependsOn', () => {
        preloadState({
            tasks: [
                makeTask({ id: 't1', title: 'A' }),
                makeTask({ id: 't2', title: 'B', dependsOn: ['t1'] })
            ]
        });
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.dispatch({ type: 'DELETE_TASK', payload: 't1' });
        });

        expect(result.current.state.tasks[0].dependsOn).not.toContain('t1');
    });

    it('DELETE_TASK: removes deleted task subtask ids from sibling subtasks dependsOn', () => {
        const taskA = makeTask({
            id: 't1',
            subtasks: [makeSubtask({ id: 's1', parentId: 't1' })]
        });
        const taskB = makeTask({
            id: 't2',
            subtasks: [makeSubtask({ id: 's2', parentId: 't2', dependsOn: ['s1'] })]
        });
        preloadState({ tasks: [taskA, taskB] });
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.dispatch({ type: 'DELETE_TASK', payload: 't1' });
        });

        const s2 = result.current.state.tasks[0].subtasks[0];
        expect(s2.dependsOn).not.toContain('s1');
    });

    // ── Subtasks ─────────────────────────────────────────────────────────

    it('ADD_SUBTASK: adds a subtask to the correct task', () => {
        preloadState({ tasks: [makeTask({ id: 't1', subtasks: [] })] });
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.dispatch({
                type: 'ADD_SUBTASK',
                payload: {
                    taskId: 't1',
                    subtask: {
                        parentId: 't1',
                        title: 'Sub',
                        notes: '',
                        completed: false
                    }
                }
            });
        });

        expect(result.current.state.tasks[0].subtasks).toHaveLength(1);
        expect(result.current.state.tasks[0].subtasks[0].id).toBeTruthy();
    });

    it('UPDATE_SUBTASK: updates the subtask title', () => {
        const task = makeTask({
            id: 't1',
            subtasks: [makeSubtask({ id: 's1', title: 'Old Sub' })]
        });
        preloadState({ tasks: [task] });
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.dispatch({
                type: 'UPDATE_SUBTASK',
                payload: {
                    taskId: 't1',
                    subtask: { ...result.current.state.tasks[0].subtasks[0], title: 'New Sub' }
                }
            });
        });

        expect(result.current.state.tasks[0].subtasks[0].title).toBe('New Sub');
    });

    it('DELETE_SUBTASK: removes the subtask and cleans its id from sibling dependsOn', () => {
        const task = makeTask({
            id: 't1',
            subtasks: [
                makeSubtask({ id: 's1', parentId: 't1' }),
                makeSubtask({ id: 's2', parentId: 't1', dependsOn: ['s1'] })
            ]
        });
        preloadState({ tasks: [task] });
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.dispatch({
                type: 'DELETE_SUBTASK',
                payload: { taskId: 't1', subtaskId: 's1' }
            });
        });

        expect(result.current.state.tasks[0].subtasks).toHaveLength(1);
        expect(result.current.state.tasks[0].subtasks[0].dependsOn).not.toContain('s1');
    });

    // ── Expenses ──────────────────────────────────────────────────────────

    it('ADD_EXPENSE: adds an expense with non-empty id', () => {
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.dispatch({
                type: 'ADD_EXPENSE',
                payload: makeExpense({ id: undefined as unknown as string })
            });
        });

        expect(result.current.state.expenses).toHaveLength(1);
        expect(result.current.state.expenses[0].id).toBeTruthy();
    });

    it('UPDATE_EXPENSE: updates the price', () => {
        preloadState({ expenses: [makeExpense({ id: 'e1', price: 100 })] });
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.dispatch({
                type: 'UPDATE_EXPENSE',
                payload: { ...result.current.state.expenses[0], price: 999 }
            });
        });

        expect(result.current.state.expenses[0].price).toBe(999);
    });

    it('DELETE_EXPENSE: removes the expense', () => {
        preloadState({ expenses: [makeExpense({ id: 'e1' })] });
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.dispatch({ type: 'DELETE_EXPENSE', payload: 'e1' });
        });

        expect(result.current.state.expenses).toHaveLength(0);
    });

    // ── Calendar events ───────────────────────────────────────────────────

    it('ADD_CALENDAR_EVENT: adds an event with non-empty id', () => {
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.dispatch({
                type: 'ADD_CALENDAR_EVENT',
                payload: makeCalendarEvent({ id: undefined as unknown as string })
            });
        });

        expect(result.current.state.calendarEvents).toHaveLength(1);
        expect(result.current.state.calendarEvents[0].id).toBeTruthy();
    });

    it('UPDATE_CALENDAR_EVENT: updates the title', () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'Old' })] });
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.dispatch({
                type: 'UPDATE_CALENDAR_EVENT',
                payload: { ...result.current.state.calendarEvents[0], title: 'New' }
            });
        });

        expect(result.current.state.calendarEvents[0].title).toBe('New');
    });

    it('DELETE_CALENDAR_EVENT: removes the event', () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1' })] });
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.dispatch({ type: 'DELETE_CALENDAR_EVENT', payload: 'ev1' });
        });

        expect(result.current.state.calendarEvents).toHaveLength(0);
    });

    // ── Budget ────────────────────────────────────────────────────────────

    it('SET_BUDGET: updates the budget value', () => {
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.dispatch({ type: 'SET_BUDGET', payload: 75000 });
        });

        expect(result.current.state.budget).toBe(75000);
    });
});

// ---------------------------------------------------------------------------
// saveToFile
// ---------------------------------------------------------------------------

describe('saveToFile', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubGlobal('alert', vi.fn());
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
        });
        vi.spyOn(document.body, 'appendChild').mockImplementation(node => node);
        vi.spyOn(document.body, 'removeChild').mockImplementation(node => node);
        vi.useFakeTimers();
    });

    afterEach(() => {
        localStorage.clear();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('does not throw regardless of compression support', async () => {
        const { result } = renderHook(() => useApp(), { wrapper });
        await expect(
            act(() => result.current.saveToFile())
        ).resolves.not.toThrow();
    });

    it('save completes: either creates a download URL (success) or shows an alert (compression unavailable)', async () => {
        const { result } = renderHook(() => useApp(), { wrapper });
        await act(() => result.current.saveToFile());
        vi.runAllTimers();

        const saved = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls.length > 0;
        const alerted = (window.alert as ReturnType<typeof vi.fn>).mock.calls.length > 0;
        expect(saved || alerted).toBe(true);
    });

    it('uses gzip path when isCompressionSupported is true', async () => {
        const compressionModule = await import('../../utils/compression');
        Object.defineProperty(compressionModule, 'isCompressionSupported', { value: true, writable: true, configurable: true });
        vi.spyOn(compressionModule, 'compressToGzip').mockResolvedValue(new Blob(['gzip-data'], { type: 'application/gzip' }));

        const { result } = renderHook(() => useApp(), { wrapper });
        await act(() => result.current.saveToFile());
        vi.runAllTimers();

        expect(compressionModule.compressToGzip).toHaveBeenCalled();
        expect(URL.createObjectURL).toHaveBeenCalled();

        Object.defineProperty(compressionModule, 'isCompressionSupported', { value: false, writable: true, configurable: true });
    });

    it('uses non-gzip path when isCompressionSupported is false', async () => {
        const compressionModule = await import('../../utils/compression');
        Object.defineProperty(compressionModule, 'isCompressionSupported', { value: false, writable: true, configurable: true });

        const { result } = renderHook(() => useApp(), { wrapper });
        await act(() => result.current.saveToFile());
        vi.runAllTimers();

        expect(URL.createObjectURL).toHaveBeenCalled();
        // Restore to original value (true in Node.js)
        Object.defineProperty(compressionModule, 'isCompressionSupported', { value: true, writable: true, configurable: true });
    });
});

// ---------------------------------------------------------------------------
// loadFromFile (JSON path)
// ---------------------------------------------------------------------------

describe('loadFromFile', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubGlobal('alert', vi.fn());
    });

    afterEach(() => {
        localStorage.clear();
        vi.unstubAllGlobals();
    });

    it('loads a valid JSON file and updates state', async () => {
        const data: AppData = {
            ...INITIAL_EMPTY,
            budget: 42000,
            notes: [makeNote({ id: 'n99', title: 'Loaded' })]
        };
        const file = new File([JSON.stringify(data)], 'backup.json', { type: 'application/json' });

        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.loadFromFile(file);
        });

        await waitFor(() => {
            expect(result.current.state.budget).toBe(42000);
            expect(result.current.state.notes[0].title).toBe('Loaded');
        });
    });

    it('calls alert on invalid JSON content', async () => {
        const file = new File(['not-valid-json{{{'], 'backup.json', { type: 'application/json' });

        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.loadFromFile(file);
        });

        await waitFor(() => {
            expect(window.alert).toHaveBeenCalled();
        });
    });

    it('calls alert when FileReader result is not a string', async () => {
        // Simulate FileReader returning a non-string result
        const OriginalFileReader = globalThis.FileReader;
        class MockFileReader {
            onload: ((e: { target: { result: null } }) => void) | null = null;
            onerror: (() => void) | null = null;
            readAsText() {
                setTimeout(() => {
                    this.onload?.({ target: { result: null } });
                }, 0);
            }
        }
        vi.stubGlobal('FileReader', MockFileReader);

        const file = new File(['data'], 'backup.json', { type: 'application/json' });
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.loadFromFile(file);
        });

        await waitFor(() => {
            expect(window.alert).toHaveBeenCalled();
        });

        vi.unstubAllGlobals();
        vi.stubGlobal('FileReader', OriginalFileReader);
        vi.stubGlobal('alert', vi.fn());
    });

    it('calls alert when FileReader fires onerror', async () => {
        const OriginalFileReader = globalThis.FileReader;
        class MockFileReader {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            readAsText() {
                setTimeout(() => {
                    this.onerror?.();
                }, 0);
            }
        }
        vi.stubGlobal('FileReader', MockFileReader);

        const file = new File(['data'], 'backup.json', { type: 'application/json' });
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.loadFromFile(file);
        });

        await waitFor(() => {
            expect(window.alert).toHaveBeenCalled();
        });

        vi.unstubAllGlobals();
        vi.stubGlobal('FileReader', OriginalFileReader);
        vi.stubGlobal('alert', vi.fn());
    });

    it.skipIf(!blobStreamSupported)('loads a .json.gz file via decompression', async () => {
        const { compressToGzip } = await import('../../utils/compression');
        const data: AppData = { ...INITIAL_EMPTY, budget: 55000 };
        const compressed = await compressToGzip(JSON.stringify(data));
        const file = new File([compressed], 'backup.json.gz', { type: 'application/gzip' });

        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.loadFromFile(file);
        });

        await waitFor(() => {
            expect(result.current.state.budget).toBe(55000);
        });
    });

    it.skipIf(!blobStreamSupported)('shows alert when .json.gz content is not valid JSON after decompression', async () => {
        // Compress garbage bytes that are not valid JSON
        const { compressToGzip } = await import('../../utils/compression');
        const compressed = await compressToGzip('this is not json {{{');
        const file = new File([compressed], 'backup.json.gz', { type: 'application/gzip' });

        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.loadFromFile(file);
        });

        await waitFor(() => {
            expect(window.alert).toHaveBeenCalledWith(
                expect.stringContaining('valid renovation backup file')
            );
        });
    });

    it('shows alert when loading a .json.gz file and compression is not supported', async () => {
        // Temporarily pretend compression is not supported
        const compressionModule = await import('../../utils/compression');
        const originalValue = compressionModule.isCompressionSupported;
        Object.defineProperty(compressionModule, 'isCompressionSupported', { value: false, writable: true, configurable: true });

        const file = new File(['fake-gz-content'], 'backup.json.gz', { type: 'application/gzip' });
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.loadFromFile(file);
        });

        await waitFor(() => {
            expect(window.alert).toHaveBeenCalledWith(
                expect.stringContaining('does not support gzip decompression')
            );
        });

        // Restore
        Object.defineProperty(compressionModule, 'isCompressionSupported', { value: originalValue, writable: true, configurable: true });
    });

    it('loads a .json.gz file via mocked decompression (covers gzip path)', async () => {
        const data: AppData = { ...INITIAL_EMPTY, budget: 77777 };
        const compressionModule = await import('../../utils/compression');
        Object.defineProperty(compressionModule, 'isCompressionSupported', { value: true, writable: true, configurable: true });
        vi.spyOn(compressionModule, 'decompressFromGzip').mockResolvedValue(JSON.stringify(data));

        const file = new File(['fake-gz-bytes'], 'backup.json.gz', { type: 'application/gzip' });
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.loadFromFile(file);
        });

        await waitFor(() => {
            expect(result.current.state.budget).toBe(77777);
        });

        Object.defineProperty(compressionModule, 'isCompressionSupported', { value: false, writable: true, configurable: true });
    });

    it('shows alert when mocked decompression throws (covers gzip error path)', async () => {
        const compressionModule = await import('../../utils/compression');
        Object.defineProperty(compressionModule, 'isCompressionSupported', { value: true, writable: true, configurable: true });
        vi.spyOn(compressionModule, 'decompressFromGzip').mockRejectedValue(new Error('decompress failed'));

        const file = new File(['bad-gz-bytes'], 'backup.json.gz', { type: 'application/gzip' });
        const { result } = renderHook(() => useApp(), { wrapper });
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        });

        act(() => {
            result.current.loadFromFile(file);
        });

        await waitFor(() => {
            expect(window.alert).toHaveBeenCalledWith(
                expect.stringContaining('valid renovation backup file')
            );
        });

        consoleSpy.mockRestore();
        Object.defineProperty(compressionModule, 'isCompressionSupported', { value: false, writable: true, configurable: true });
    });
});

// ---------------------------------------------------------------------------
// CalendarEvent migration (workType + color → eventType)
// ---------------------------------------------------------------------------

describe('CalendarEvent migration', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
        vi.unstubAllGlobals();
    });

    it('migrates old-format events (workType) from localStorage to eventType: "event"', () => {
        const oldEvent = { id: 'ev1', title: 'Old Meeting', date: '2024-01-01', workType: 'Planning' };
        localStorage.setItem('renovation-data', JSON.stringify({ ...INITIAL_EMPTY, calendarEvents: [oldEvent] }));

        const { result } = renderHook(() => useApp(), { wrapper });

        expect(result.current.state.calendarEvents[0].eventType).toBe('event');
    });

    it('strips workType and color from migrated events', () => {
        const oldEvent = { id: 'ev1', title: 'Old Meeting', date: '2024-01-01', workType: 'Plumbing', color: '#EF4444' };
        localStorage.setItem('renovation-data', JSON.stringify({ ...INITIAL_EMPTY, calendarEvents: [oldEvent] }));

        const { result } = renderHook(() => useApp(), { wrapper });

        const migrated = result.current.state.calendarEvents[0];
        expect(migrated.eventType).toBe('event');
        expect('workType' in migrated).toBe(false);
        expect('color' in migrated).toBe(false);
    });

    it('leaves already-migrated events (with eventType) unchanged', () => {
        const newEvent = makeCalendarEvent({ id: 'ev1', eventType: 'contractor work' });
        localStorage.setItem('renovation-data', JSON.stringify({ ...INITIAL_EMPTY, calendarEvents: [newEvent] }));

        const { result } = renderHook(() => useApp(), { wrapper });

        expect(result.current.state.calendarEvents[0].eventType).toBe('contractor work');
    });

    it('migrates old-format events from a loaded JSON file', async () => {
        vi.stubGlobal('alert', vi.fn());
        const oldEvent = { id: 'ev2', title: 'Site Visit', date: '2024-02-01', workType: 'Inspection' };
        const fileData = JSON.stringify({ ...INITIAL_EMPTY, calendarEvents: [oldEvent] });
        const file = new File([fileData], 'backup.json', { type: 'application/json' });

        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.loadFromFile(file);
        });

        await waitFor(() => {
            expect(result.current.state.calendarEvents[0].eventType).toBe('event');
            expect('workType' in result.current.state.calendarEvents[0]).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// Multi-project: init paths
// ---------------------------------------------------------------------------

describe('AppContext – multi-project init', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('migrates legacy renovation-data key to a new project on first load', () => {
        localStorage.setItem(
            LEGACY_DATA_KEY,
            JSON.stringify({ ...INITIAL_EMPTY, budget: 42 })
        );

        const { result } = renderHook(() => useApp(), { wrapper });

        expect(result.current.state.budget).toBe(42);
        expect(result.current.projectMeta).not.toBeNull();
        expect(result.current.projectMeta!.name).toBe('My Project');
        // legacy key should be removed
        expect(localStorage.getItem(LEGACY_DATA_KEY)).toBeNull();
    });

    it('does not migrate legacy key when projects already exist', () => {
        // Pre-create a project (new format)
        localStorage.setItem(
            `${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`,
            JSON.stringify({ meta: { name: 'Existing', lastModified: '2024-01-01T00:00:00.000Z' }, data: INITIAL_EMPTY })
        );
        localStorage.setItem(ACTIVE_PROJECT_KEY, TEST_PROJECT_ID);
        // Also set a legacy key with different budget — should be ignored
        localStorage.setItem(LEGACY_DATA_KEY, JSON.stringify({ ...INITIAL_EMPTY, budget: 999 }));

        const { result } = renderHook(() => useApp(), { wrapper });

        expect(result.current.state.budget).toBe(0);
        expect(localStorage.getItem(LEGACY_DATA_KEY)).not.toBeNull(); // not removed
    });

    it('shows project picker when no active project is set', () => {
        const { result } = renderHook(() => useApp(), { wrapper });

        expect(result.current.needsProjectSelection).toBe(true);
        expect(result.current.projectMeta).toBeNull();
    });

    it('clears stale ACTIVE_PROJECT_KEY and shows picker when pointed project does not exist', () => {
        localStorage.setItem(ACTIVE_PROJECT_KEY, 'nonexistent-id');

        const { result } = renderHook(() => useApp(), { wrapper });

        expect(result.current.needsProjectSelection).toBe(true);
        expect(localStorage.getItem(ACTIVE_PROJECT_KEY)).toBeNull();
    });

    it('handles initialize() failure gracefully (sets projects to empty)', async () => {
        vi.spyOn(storageManager.provider, 'initialize').mockRejectedValue(new Error('init failed'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        });

        const { result } = renderHook(() => useApp(), { wrapper });

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to initialize storage provider or load projects:',
                expect.any(Error)
            );
        });

        consoleSpy.mockRestore();
        vi.restoreAllMocks();
        expect(result.current.needsProjectSelection).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Multi-project: selectProject / createNewProject / renameProject
// ---------------------------------------------------------------------------

describe('AppContext – project management', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('selectProject loads the project data into state', async () => {
        const id2 = 'project-two';
        localStorage.setItem(
            `${STORAGE_KEY_PREFIX}${id2}`,
            JSON.stringify({ meta: { name: 'Second', lastModified: '2024-02-01T00:00:00.000Z' }, data: { ...INITIAL_EMPTY, budget: 500 } })
        );

        const { result } = renderHook(() => useApp(), { wrapper });

        await act(async () => {
            await result.current.selectProject(id2);
        });

        expect(result.current.state.budget).toBe(500);
        expect(result.current.projectMeta?.name).toBe('Second');
        expect(result.current.needsProjectSelection).toBe(false);
        expect(localStorage.getItem(ACTIVE_PROJECT_KEY)).toBe(id2);
    });

    it('selectProject does not overwrite lastModified in storage', async () => {
        const id2 = 'project-two';
        const originalLM = '2024-02-01T00:00:00.000Z';
        localStorage.setItem(
            `${STORAGE_KEY_PREFIX}${id2}`,
            JSON.stringify({ meta: { name: 'Second', lastModified: originalLM }, data: INITIAL_EMPTY })
        );

        const { result } = renderHook(() => useApp(), { wrapper });

        await act(async () => {
            await result.current.selectProject(id2);
        });

        await new Promise(r => setTimeout(r, 20));

        const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${id2}`);
        const stored = JSON.parse(raw ?? '{}') as { meta: { lastModified: string } };
        expect(stored.meta.lastModified).toBe(originalLM);
    });

    it('initial hydration does not overwrite lastModified in storage', async () => {
        const originalLM = '2024-01-01T00:00:00.000Z';
        preloadState({});

        renderHook(() => useApp(), { wrapper });

        await new Promise(r => setTimeout(r, 20));

        const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`);
        const stored = JSON.parse(raw ?? '{}') as { meta: { lastModified: string } };
        expect(stored.meta.lastModified).toBe(originalLM);
    });

    it('selectProject does nothing for a non-existent project id', async () => {
        // Start with a project selected so we can detect if it changes
        preloadState({ budget: 100 });
        const { result } = renderHook(() => useApp(), { wrapper });
        const budgetBefore = result.current.state.budget;

        await act(async () => {
            await result.current.selectProject('does-not-exist');
        });

        expect(result.current.state.budget).toBe(budgetBefore);
    });

    it('createNewProject switches to a blank project', async () => {
        preloadState({ budget: 777 });
        const { result } = renderHook(() => useApp(), { wrapper });

        await act(async () => {
            await result.current.createNewProject('Fresh Project');
        });

        expect(result.current.state.budget).toBe(0);
        expect(result.current.projectMeta?.name).toBe('Fresh Project');
        expect(result.current.needsProjectSelection).toBe(false);
        expect(localStorage.getItem(ACTIVE_PROJECT_KEY)).not.toBeNull();
    });

    it('renameProject updates projectMeta.name in state', async () => {
        preloadState({});
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.renameProject('Renamed Project');
        });

        await waitFor(() => {
            expect(result.current.projectMeta?.name).toBe('Renamed Project');
        });
    });

    it('renameProject persists the new name to localStorage', async () => {
        preloadState({});
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.renameProject('Stored Name');
        });

        await waitFor(() => {
            const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`);
            const stored = JSON.parse(raw ?? '{}') as { meta: { name: string } };
            expect(stored.meta.name).toBe('Stored Name');
        });
    });

    it('renameProject does nothing when projectMeta is null', () => {
        // No project selected — needsProjectSelection=true, projectMeta=null
        const { result } = renderHook(() => useApp(), { wrapper });
        expect(result.current.projectMeta).toBeNull();

        expect(() => {
            act(() => {
                result.current.renameProject('Anything');
            });
        }).not.toThrow();
    });

    it('renameProject shows alert when storage renameProject rejects', async () => {
        preloadState({});
        vi.stubGlobal('alert', vi.fn());
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        });
        vi.spyOn(storageManager.provider, 'renameProject').mockRejectedValue(new Error('rename failed'));

        const { result } = renderHook(() => useApp(), { wrapper });
        act(() => {
            result.current.renameProject('Bad Name');
        });

        await waitFor(() => {
            expect(window.alert).toHaveBeenCalledWith(
                expect.stringContaining('Failed to rename project')
            );
        });

        consoleSpy.mockRestore();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('openProjectSelector sets needsProjectSelection to true', async () => {
        preloadState({});
        const { result } = renderHook(() => useApp(), { wrapper });
        expect(result.current.needsProjectSelection).toBe(false);

        await act(async () => {
            await result.current.openProjectSelector();
        });

        expect(result.current.needsProjectSelection).toBe(true);
    });

    it('saveError is null initially', () => {
        preloadState({});
        const { result } = renderHook(() => useApp(), { wrapper });
        expect(result.current.saveError).toBeNull();
    });

    it('saveError is set when saveProject rejects, and clearSaveError clears it', async () => {
        preloadState({});
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        });
        const saveSpy = vi
            .spyOn(storageManager.provider, 'saveProject')
            .mockRejectedValueOnce(new Error('disk quota exceeded'));

        const { result } = renderHook(() => useApp(), { wrapper });

        await act(async () => {
            result.current.dispatch({ type: 'SET_BUDGET', payload: 12345 });
        });

        await waitFor(() => {
            expect(result.current.saveError).toMatch(/disk quota exceeded/);
        });

        act(() => {
            result.current.clearSaveError();
        });

        expect(result.current.saveError).toBeNull();

        saveSpy.mockRestore();
        errorSpy.mockRestore();
    });

    it('saveError is cleared on the next successful save', async () => {
        preloadState({});
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        });
        const saveSpy = vi
            .spyOn(storageManager.provider, 'saveProject')
            .mockRejectedValueOnce(new Error('transient failure'));

        const { result } = renderHook(() => useApp(), { wrapper });

        // First change causes rejected save → saveError set
        await act(async () => {
            result.current.dispatch({ type: 'SET_BUDGET', payload: 1 });
        });

        await waitFor(() => {
            expect(result.current.saveError).not.toBeNull();
        });

        saveSpy.mockRestore();
        errorSpy.mockRestore();

        // Second change uses the real (succeeding) saveProject → saveError cleared
        await act(async () => {
            result.current.dispatch({ type: 'SET_BUDGET', payload: 2 });
        });

        await waitFor(() => {
            expect(result.current.saveError).toBeNull();
        });
    });
});
