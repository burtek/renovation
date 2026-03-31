import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppData, CalendarEvent, Expense, Note, Subtask, Task } from '../types';
import { isCompressionSupported } from '../utils/compression';

import { AppProvider, useApp } from './AppContext';


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

function preloadState(state: Partial<AppData>) {
    localStorage.setItem('renovation-data', JSON.stringify({ ...INITIAL_EMPTY, ...state }));
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

    it('falls back to empty state on invalid JSON', () => {
        localStorage.setItem('renovation-data', 'not-json{{{{');
        const { result } = renderHook(() => useApp(), { wrapper });
        expect(result.current.state.budget).toBe(0);
        expect(result.current.state.notes).toHaveLength(0);
    });

    it('persists state to localStorage after dispatch', async () => {
        const { result } = renderHook(() => useApp(), { wrapper });

        act(() => {
            result.current.dispatch({ type: 'SET_BUDGET', payload: 12345 });
        });

        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem('renovation-data') ?? '{}') as AppData;
            expect(stored.budget).toBe(12345);
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

    it('either calls URL.createObjectURL (success) or alert (failure)', async () => {
        const { result } = renderHook(() => useApp(), { wrapper });
        await act(() => result.current.saveToFile());
        vi.runAllTimers();

        const succeeded = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls.length > 0;
        const failed = (window.alert as ReturnType<typeof vi.fn>).mock.calls.length > 0;
        expect(succeeded || failed).toBe(true);
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
        const { compressToGzip } = await import('../utils/compression');
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

    it('shows alert when loading a .json.gz file and compression is not supported', async () => {
        // Temporarily pretend compression is not supported
        const compressionModule = await import('../utils/compression');
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
