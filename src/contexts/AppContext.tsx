import type { Dispatch, ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import ProjectModal from '../components/ProjectModal';
import type { ProjectMeta } from '../storage';
import { defaultStorageProvider } from '../storage';
import { ACTIVE_PROJECT_KEY, LEGACY_DATA_KEY, STORAGE_KEY_PREFIX } from '../storage/types';
import type { AppData, Note, Task, Subtask, Expense, CalendarEvent, CalendarEventType } from '../types';
import { compressToGzip, decompressFromGzip, isCompressionSupported } from '../utils/compression';


const initialState: AppData = {
    notes: [],
    tasks: [],
    expenses: [],
    calendarEvents: [],
    budget: 0
};

type Action
    = | { type: 'SET_ALL'; payload: AppData }
        | { type: 'ADD_NOTE'; payload: Omit<Note, 'createdAt' | 'updatedAt'> }
        | { type: 'UPDATE_NOTE'; payload: Note }
        | { type: 'DELETE_NOTE'; payload: string }
        | { type: 'ADD_TASK'; payload: Omit<Task, 'id'> }
        | { type: 'UPDATE_TASK'; payload: Task }
        | { type: 'DELETE_TASK'; payload: string }
        | { type: 'ADD_SUBTASK'; payload: { taskId: string; subtask: Omit<Subtask, 'id'> } }
        | { type: 'UPDATE_SUBTASK'; payload: { taskId: string; subtask: Subtask } }
        | { type: 'DELETE_SUBTASK'; payload: { taskId: string; subtaskId: string } }
        | { type: 'ADD_EXPENSE'; payload: Omit<Expense, 'id'> }
        | { type: 'UPDATE_EXPENSE'; payload: Expense }
        | { type: 'DELETE_EXPENSE'; payload: string }
        | { type: 'ADD_CALENDAR_EVENT'; payload: Omit<CalendarEvent, 'id'> }
        | { type: 'UPDATE_CALENDAR_EVENT'; payload: CalendarEvent }
        | { type: 'DELETE_CALENDAR_EVENT'; payload: string }
        | { type: 'SET_BUDGET'; payload: number };

// eslint-disable-next-line consistent-return, @typescript-eslint/consistent-return
function reducer(state: AppData, action: Action): AppData {
    switch (action.type) {
        case 'SET_ALL':
            return action.payload;
        case 'ADD_NOTE': {
            const now = new Date().toISOString();
            const note: Note = { ...action.payload, createdAt: now, updatedAt: now };
            return { ...state, notes: [...state.notes, note] };
        }
        case 'UPDATE_NOTE': {
            const updated = { ...action.payload, updatedAt: new Date().toISOString() };
            return { ...state, notes: state.notes.map(n => (n.id === updated.id ? updated : n)) };
        }
        case 'DELETE_NOTE':
            return { ...state, notes: state.notes.filter(n => n.id !== action.payload) };
        case 'ADD_TASK': {
            const task: Task = { ...action.payload, id: uuidv4() };
            return { ...state, tasks: [...state.tasks, task] };
        }
        case 'UPDATE_TASK':
            return { ...state, tasks: state.tasks.map(t => (t.id === action.payload.id ? action.payload : t)) };
        case 'DELETE_TASK': {
            const taskId = action.payload;
            // Collect all subtask IDs belonging to the deleted task
            const deletedTask = state.tasks.find(t => t.id === taskId);
            const deletedSubtaskIds = new Set(deletedTask?.subtasks.map(s => s.id) ?? []);
            const remainingTasks = state.tasks.filter(t => t.id !== taskId);
            const cleanedTasks = remainingTasks.map(t => {
                const cleanedDependsOn = t.dependsOn?.length
                    ? t.dependsOn.filter(id => id !== taskId)
                    : t.dependsOn;
                const subtasksNeedCleaning = deletedSubtaskIds.size > 0
                    && t.subtasks.some(s => s.dependsOn?.some(id => deletedSubtaskIds.has(id)));
                const cleanedSubtasks = subtasksNeedCleaning
                    ? t.subtasks.map(s => {
                        if (!s.dependsOn?.length) {
                            return s;
                        }
                        const newDependsOn = s.dependsOn.filter(id => !deletedSubtaskIds.has(id));
                        return newDependsOn.length === s.dependsOn.length ? s : { ...s, dependsOn: newDependsOn };
                    })
                    : t.subtasks;
                const taskDependsOnChanged = cleanedDependsOn !== t.dependsOn
                    && cleanedDependsOn?.length !== t.dependsOn?.length;
                return taskDependsOnChanged || subtasksNeedCleaning
                    ? { ...t, dependsOn: cleanedDependsOn, subtasks: cleanedSubtasks }
                    : t;
            });
            return { ...state, tasks: cleanedTasks };
        }
        case 'ADD_SUBTASK': {
            const subtask: Subtask = { ...action.payload.subtask, id: uuidv4() };
            return {
                ...state,
                tasks: state.tasks.map(t =>
                    (t.id === action.payload.taskId ? { ...t, subtasks: [...t.subtasks, subtask] } : t))
            };
        }
        case 'UPDATE_SUBTASK':
            return {
                ...state,
                tasks: state.tasks.map(t =>
                    (t.id === action.payload.taskId
                        ? { ...t, subtasks: t.subtasks.map(s => (s.id === action.payload.subtask.id ? action.payload.subtask : s)) }
                        : t))
            };
        case 'DELETE_SUBTASK': {
            const { taskId, subtaskId } = action.payload;
            return {
                ...state,
                tasks: state.tasks.map(t => {
                    const filteredSubtasks = t.id === taskId
                        ? t.subtasks.filter(s => s.id !== subtaskId)
                        : t.subtasks;
                    const cleanedSubtasks = filteredSubtasks.map(s => {
                        if (!s.dependsOn?.length) {
                            return s;
                        }
                        const newDependsOn = s.dependsOn.filter(id => id !== subtaskId);
                        return newDependsOn.length === s.dependsOn.length ? s : { ...s, dependsOn: newDependsOn };
                    });
                    return { ...t, subtasks: cleanedSubtasks };
                })
            };
        }
        case 'ADD_EXPENSE': {
            const expense: Expense = { ...action.payload, id: uuidv4() };
            return { ...state, expenses: [...state.expenses, expense] };
        }
        case 'UPDATE_EXPENSE':
            return { ...state, expenses: state.expenses.map(e => (e.id === action.payload.id ? action.payload : e)) };
        case 'DELETE_EXPENSE':
            return { ...state, expenses: state.expenses.filter(e => e.id !== action.payload) };
        case 'ADD_CALENDAR_EVENT': {
            const event: CalendarEvent = { ...action.payload, id: uuidv4() };
            return { ...state, calendarEvents: [...state.calendarEvents, event] };
        }
        case 'UPDATE_CALENDAR_EVENT':
            return { ...state, calendarEvents: state.calendarEvents.map(e => (e.id === action.payload.id ? action.payload : e)) };
        case 'DELETE_CALENDAR_EVENT':
            return { ...state, calendarEvents: state.calendarEvents.filter(e => e.id !== action.payload) };
        case 'SET_BUDGET':
            return { ...state, budget: action.payload };
    }
}

// ---------------------------------------------------------------------------
// Data migration: convert events saved in older format (workType + color)
// ---------------------------------------------------------------------------

function migrateCalendarEvents(raw: unknown[]): CalendarEvent[] {
    return raw.map(item => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        const e = item as Record<string, unknown>;
        if (!e.eventType) {
            // Old format had free-text workType and optional color; default to 'event'

            const { workType: _w, color: _c, ...rest } = e;
            const eventType: CalendarEventType = 'event';

            const migrated = { ...rest, eventType } as unknown;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            return migrated as CalendarEvent;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        return item as CalendarEvent;
    });
}

function parseAppData(parsed: Partial<AppData>): AppData {
    return {
        ...initialState,
        ...parsed,
        calendarEvents: Array.isArray(parsed.calendarEvents)
            ? migrateCalendarEvents(parsed.calendarEvents)
            : initialState.calendarEvents
    };
}

interface AppContextType {
    state: AppData;
    dispatch: Dispatch<Action>;
    saveToFile: () => Promise<void>;
    loadFromFile: (file: File) => void;
    projectMeta: ProjectMeta | null;
    needsProjectSelection: boolean;
    openProjectSelector: () => void;
    selectProject: (id: string) => void;
    createNewProject: (name: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);
AppContext.displayName = 'AppContext';

interface InitResult {
    state: AppData;
    meta: ProjectMeta | null;
    needsPicker: boolean;
}

function initializeFromStorage(): InitResult {
    try {
        // Step 1: Migrate legacy 'renovation-data' key if no projects exist yet
        const legacyRaw = localStorage.getItem(LEGACY_DATA_KEY);
        const hasProjects = defaultStorageProvider.listProjects().length > 0;

        if (legacyRaw && !hasProjects) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
                const parsed = JSON.parse(legacyRaw) as Partial<AppData>;
                const appData = parseAppData(parsed);
                const id = uuidv4();
                const now = new Date().toISOString();
                const meta: ProjectMeta = { id, name: 'My Project', lastModified: now };
                localStorage.setItem(
                    `${STORAGE_KEY_PREFIX}${id}`,
                    JSON.stringify({ name: meta.name, lastModified: meta.lastModified, ...appData })
                );
                localStorage.setItem(ACTIVE_PROJECT_KEY, id);
                localStorage.removeItem(LEGACY_DATA_KEY);
                return { state: appData, meta, needsPicker: false };
            } catch {
                localStorage.removeItem(LEGACY_DATA_KEY);
            }
        }

        // Step 2: Try to load the last active project
        const activeId = localStorage.getItem(ACTIVE_PROJECT_KEY);
        if (activeId) {
            const loaded = defaultStorageProvider.loadProject(activeId);
            if (loaded) {
                const appData = parseAppData(loaded.rawData);
                return { state: appData, meta: loaded.meta, needsPicker: false };
            }
            // Stale pointer — clear it and show picker
            localStorage.removeItem(ACTIVE_PROJECT_KEY);
        }
    } catch {
        // localStorage unavailable — start fresh
    }

    // Step 3: No active project — show project picker
    return { state: initialState, meta: null, needsPicker: true };
}

export function AppProvider({ children }: { children: ReactNode }) {
    const [{ state: initState, meta: initMeta, needsPicker }] = useState(initializeFromStorage);
    const [state, dispatch] = useReducer(reducer, initState);
    const [projectMeta, setProjectMeta] = useState<ProjectMeta | null>(initMeta);
    const [needsProjectSelection, setNeedsProjectSelection] = useState(needsPicker);
    const [projects, setProjects] = useState<ProjectMeta[]>(() => {
        if (needsPicker) {
            return defaultStorageProvider.listProjects();
        }
        return [];
    });

    // Keep a stable ref so the save effect always sees the latest meta without being re-triggered by it
    const projectMetaRef = useRef(projectMeta);
    projectMetaRef.current = projectMeta;

    // Persist state to the active project's storage key whenever state changes
    useEffect(() => {
        const meta = projectMetaRef.current;
        if (!meta) {
            return;
        }
        const now = new Date().toISOString();
        defaultStorageProvider.saveProject(meta.id, meta.name, state);
        // eslint-disable-next-line @eslint-react/set-state-in-effect
        setProjectMeta(prev => (prev ? { ...prev, lastModified: now } : null));
    }, [state]);

    const openProjectSelector = useCallback(() => {
        setProjects(defaultStorageProvider.listProjects());
        setNeedsProjectSelection(true);
    }, []);

    const selectProject = useCallback((id: string) => {
        const loaded = defaultStorageProvider.loadProject(id);
        if (!loaded) {
            return;
        }
        const appData = parseAppData(loaded.rawData);
        dispatch({ type: 'SET_ALL', payload: appData });
        setProjectMeta(loaded.meta);
        setNeedsProjectSelection(false);
        localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    }, []);

    const createNewProject = useCallback((name: string) => {
        const id = defaultStorageProvider.createProject(name);
        const now = new Date().toISOString();
        const meta: ProjectMeta = { id, name, lastModified: now };
        dispatch({ type: 'SET_ALL', payload: initialState });
        setProjectMeta(meta);
        setNeedsProjectSelection(false);
        localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    }, []);

    const saveToFile = useCallback(async () => {
        try {
            const [dateStr] = new Date().toISOString().split('T');
            let blob: Blob;
            let filename: string;
            if (isCompressionSupported) {
                blob = await compressToGzip(JSON.stringify(state, null, 2));
                filename = `renovation-backup-${dateStr}.json.gz`;
            } else {
                blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
                filename = `renovation-backup-${dateStr}.json`;
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 0);
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('Failed to save backup file:', err);
            // eslint-disable-next-line no-alert
            alert('Failed to save backup file. Please try again.');
        }
    }, [state]);

    const loadFromFile = useCallback((file: File) => {
        const parseAndLoad = (text: string) => {
            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
                const data = parseAppData(JSON.parse(text) as Partial<AppData>);
                dispatch({ type: 'SET_ALL', payload: data });
            } catch {
                // eslint-disable-next-line no-alert
                alert('Failed to parse file. Please ensure the file is a valid renovation backup file.');
            }
        };

        const handleError = () => {
            // eslint-disable-next-line no-alert
            alert('Failed to load file. Please ensure the file is a valid renovation backup file.');
        };

        if (file.name.endsWith('.json.gz')) {
            if (!isCompressionSupported) {
                // eslint-disable-next-line no-alert
                alert('Your browser does not support gzip decompression. Please use a modern browser to load .json.gz backup files.');
                return;
            }
            const loadGzip = async () => {
                try {
                    parseAndLoad(await decompressFromGzip(file));
                } catch (err) {
                    // eslint-disable-next-line no-console
                    console.error('Failed to decompress backup file:', err);
                    handleError();
                }
            };
            void loadGzip();
        } else {
            const reader = new FileReader();
            reader.onload = e => {
                const text = e.target?.result;
                if (typeof text === 'string') {
                    parseAndLoad(text);
                } else {
                    handleError();
                }
            };
            reader.onerror = handleError;
            reader.readAsText(file);
        }
    }, []);

    const contextValue = useMemo(
        () => ({
            state,
            dispatch,
            saveToFile,
            loadFromFile,
            projectMeta,
            needsProjectSelection,
            openProjectSelector,
            selectProject,
            createNewProject
        }),
        [state, dispatch, saveToFile, loadFromFile, projectMeta, needsProjectSelection, openProjectSelector, selectProject, createNewProject]
    );

    return (
        <AppContext.Provider value={contextValue}>
            {needsProjectSelection && (
                <ProjectModal
                    projects={projects}
                    onSelect={selectProject}
                    onCreate={createNewProject}
                />
            )}
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx) {
        throw new Error('useApp must be used within AppProvider');
    }
    return ctx;
}
