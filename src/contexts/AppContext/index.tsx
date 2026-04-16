import type { Dispatch, ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import ProjectModal from '../../components/ProjectModal';
import StorageProviderModal from '../../components/StorageProviderModal';
import type { ProjectMeta } from '../../storage';
import { allProvidersReady, getAvailableProviders, hasOptionalProviders, storageManager } from '../../storage';
import { ACTIVE_PROJECT_KEY, LEGACY_DATA_KEY, STORAGE_KEY_PREFIX } from '../../storage/types';
import type { AppData, CalendarEvent, CalendarEventType } from '../../types';
import { compressToGzip, decompressFromGzip, isCompressionSupported } from '../../utils/compression';

import type { Action } from './state';
import { reducer } from './state';


const initialState: AppData = {
    notes: [],
    tasks: [],
    expenses: [],
    calendarEvents: [],
    budget: 0
};

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

// ---------------------------------------------------------------------------
// Synchronous initial state load from localStorage
// ---------------------------------------------------------------------------

interface InitialLoadResult {
    state: AppData;
    meta: ProjectMeta | null;
    needsPicker: boolean;
}

function tryLoadProjectSync(id: string): { meta: ProjectMeta; rawData: Partial<AppData> } | null {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${id}`);
    if (!raw) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (
            typeof parsed !== 'object' || parsed === null
            || !('meta' in parsed) || typeof (parsed as Record<string, unknown>).meta !== 'object'
            || !('data' in parsed) || typeof (parsed as Record<string, unknown>).data !== 'object'
        ) {
            return null;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        const { meta, data } = parsed as { meta: Record<string, unknown>; data: Partial<AppData> };
        if (typeof meta.name !== 'string' || typeof meta.lastModified !== 'string') {
            return null;
        }
        return { meta: { id, name: meta.name, lastModified: meta.lastModified }, rawData: data };
    } catch {
        return null;
    }
}

function loadInitialState(): InitialLoadResult {
    // 1. Try to restore the last active project
    const activeId = localStorage.getItem(ACTIVE_PROJECT_KEY);
    if (activeId) {
        const loaded = tryLoadProjectSync(activeId);
        if (loaded) {
            return { state: parseAppData(loaded.rawData), meta: loaded.meta, needsPicker: false };
        }
        // stale pointer – clear it so the picker appears clean
        localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }

    // 2. Try to migrate the legacy single-project key
    const legacyRaw = localStorage.getItem(LEGACY_DATA_KEY);
    const hasProjects = Object.keys(localStorage).some(k => k.startsWith(STORAGE_KEY_PREFIX));
    if (legacyRaw && !hasProjects) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            const appData = parseAppData(JSON.parse(legacyRaw) as Partial<AppData>);
            const id = uuidv4();
            const lastModified = new Date().toISOString();
            const record = { meta: { name: 'My Project', lastModified }, data: appData };
            localStorage.setItem(`${STORAGE_KEY_PREFIX}${id}`, JSON.stringify(record));
            localStorage.setItem(ACTIVE_PROJECT_KEY, id);
            localStorage.removeItem(LEGACY_DATA_KEY);
            return { state: appData, meta: { id, name: 'My Project', lastModified }, needsPicker: false };
        } catch {
            localStorage.removeItem(LEGACY_DATA_KEY);
        }
    }

    return { state: initialState, meta: null, needsPicker: true };
}

interface AppContextType {
    state: AppData;
    dispatch: Dispatch<Action>;
    saveToFile: () => Promise<void>;
    loadFromFile: (file: File) => void;
    projectMeta: ProjectMeta | null;
    needsProjectSelection: boolean;
    openProjectSelector: () => Promise<void>;
    selectProject: (id: string) => Promise<void>;
    createNewProject: (name: string) => Promise<void>;
    renameProject: (newName: string) => void;
    saveError: string | null;
    clearSaveError: () => void;
}

const AppContext = createContext<AppContextType | null>(null);
AppContext.displayName = 'AppContext';


export function AppProvider({ children }: { children: ReactNode }) {
    // When any optional provider is configured, always start with provider selection;
    // otherwise skip straight to the existing local-storage flow (backward-compatible).

    const [{ state: initState, meta: initMeta, needsPicker }] = useState(() => {
        if (hasOptionalProviders) {
            return { state: initialState, meta: null as ProjectMeta | null, needsPicker: false };
        }
        return loadInitialState();
    });
    const [state, dispatch] = useReducer(reducer, initState);
    const [projectMeta, setProjectMeta] = useState(initMeta);
    const [needsProjectSelection, setNeedsProjectSelection] = useState(
        hasOptionalProviders ? false : needsPicker
    );
    const [needsProviderSelection, setNeedsProviderSelection] = useState(hasOptionalProviders);
    const [projects, setProjects] = useState<ProjectMeta[]>([]);
    const [saveError, setSaveError] = useState<string | null>(null);
    const clearSaveError = useCallback(() => {
        setSaveError(null);
    }, []);

    // Track whether all optional provider modules have finished loading.
    // Starts as false when any optional provider is configured (modules load asynchronously), true otherwise.
    const [providersReady, setProvidersReady] = useState(!hasOptionalProviders);
    useEffect(() => {
        if (!hasOptionalProviders) {
            return;
        }
        void (async () => {
            await allProvidersReady;
            setProvidersReady(true);
        })();
    }, []);

    // Build the list of provider options to show in the storage-selection modal.
    // Recomputes when `providersReady` changes (optional providers flip from disabled→enabled).
    const availableProviders = useMemo(
        () => getAvailableProviders(providersReady),
        [providersReady]
    );

    // Load projects list on mount (for the project picker) – only when no optional providers are
    // configured so that the existing auto-load / project-picker flow continues to work unchanged.
    useEffect(() => {
        if (hasOptionalProviders) {
            return;
        }
        void (async () => {
            try {
                await storageManager.provider.initialize();
                const availableProjects = await storageManager.provider.listProjects();
                setProjects(availableProjects);
            } catch (error: unknown) {
                // eslint-disable-next-line no-console
                console.error('Failed to initialize storage provider or load projects:', error);
            }
        })();
    }, []);

    // Keep a stable ref so the save effect always sees the latest meta without being re-triggered by it
    const projectMetaRef = useRef(projectMeta);
    projectMetaRef.current = projectMeta;

    // Tracks whether the next state change should be skipped for persistence.
    // Initialized to true so the initial hydration render never overwrites the stored lastModified.
    const skipNextSaveRef = useRef(true);

    // Persist state to the active project's storage key whenever state changes
    useEffect(() => {
        if (skipNextSaveRef.current) {
            skipNextSaveRef.current = false;
            return;
        }
        const meta = projectMetaRef.current;
        if (!meta) {
            return;
        }
        const now = new Date().toISOString();
        void storageManager.provider.saveProject(meta.id, meta.name, state)
            // eslint-disable-next-line promise/prefer-await-to-then
            .then(() => {
                setSaveError(null);
                setProjectMeta(prev => (prev ? { ...prev, lastModified: now } : null));
            })
            // eslint-disable-next-line promise/prefer-await-to-then, promise/prefer-await-to-callbacks
            .catch((error: unknown) => {
                const message = error instanceof Error ? error.message : String(error);
                // eslint-disable-next-line no-console
                console.error('Failed to auto-save project:', error);
                setSaveError(`Auto-save failed: ${message}`);
            });
    }, [state]);

    // ── Storage provider selection callbacks ─────────────────────────────

    const handleSelectProvider = useCallback(async (id: string) => {
        // Always call setProvider so the manager records the choice explicitly
        storageManager.setProvider(id);
        if (storageManager.provider.id !== id) {
            throw new Error(`${id} provider failed to load. Please reload the page and try again.`);
        }

        // Initialize storage and list projects; if this throws the error propagates to the modal
        // so the user sees an error message and can retry.
        await storageManager.provider.initialize();
        const availableProjects = await storageManager.provider.listProjects();
        setProjects(availableProjects);

        if (id === 'LS_OPFS') {
            // Load initial state from localStorage synchronously (cannot fail)
            const { state: localState, meta: localMeta, needsPicker: localNeedsPicker } = loadInitialState();
            if (localState !== initialState) {
                skipNextSaveRef.current = true;
                dispatch({ type: 'SET_ALL', payload: localState });
            }
            setProjectMeta(localMeta);
            setNeedsProjectSelection(localNeedsPicker);
        } else {
            // Non-local providers always show the project picker after auth
            setNeedsProjectSelection(true);
        }

        // Dismiss the provider-selection modal only after everything succeeds
        setNeedsProviderSelection(false);
    }, [dispatch]);

    // ── Project management callbacks ─────────────────────────────────────

    const openProjectSelector = useCallback(async () => {
        setProjects(await storageManager.provider.listProjects());
        setNeedsProjectSelection(true);
    }, []);

    const selectProject = useCallback(async (id: string) => {
        const loaded = await storageManager.provider.loadProject(id);
        if (!loaded) {
            return;
        }
        const appData = parseAppData(loaded.rawData);
        // Prevent the persist effect from running on this load — it would overwrite lastModified with 'now'
        skipNextSaveRef.current = true;
        dispatch({ type: 'SET_ALL', payload: appData });
        setProjectMeta(loaded.meta);
        setNeedsProjectSelection(false);
        // Only persist the active project pointer for the local provider
        if (storageManager.provider.id === 'LS_OPFS') {
            localStorage.setItem(ACTIVE_PROJECT_KEY, id);
        }
    }, []);

    const createNewProject = useCallback(async (name: string) => {
        const id = await storageManager.provider.createProject(name);
        const now = new Date().toISOString();
        const meta: ProjectMeta = { id, name, lastModified: now };
        // Prevent the persist effect from running — createProject already wrote the initial record
        skipNextSaveRef.current = true;
        dispatch({ type: 'SET_ALL', payload: initialState });
        setProjectMeta(meta);
        setNeedsProjectSelection(false);
        // Only persist the active project pointer for the local provider
        if (storageManager.provider.id === 'LS_OPFS') {
            localStorage.setItem(ACTIVE_PROJECT_KEY, id);
        }
    }, []);

    const renameProject = useCallback((newName: string) => {
        const meta = projectMetaRef.current;
        if (!meta) {
            return;
        }
        const { id } = meta;
        void (async () => {
            try {
                await storageManager.provider.renameProject(id, newName);
                setProjectMeta(prev => (prev ? { ...prev, name: newName } : prev));
            } catch (err: unknown) {
                // eslint-disable-next-line no-console
                console.error('Failed to rename project:', err);
                // eslint-disable-next-line no-alert
                alert('Failed to rename project. Please try again.');
            }
        })();
    }, []);

    const saveToFile = useCallback(async () => {
        try {
            const [dateStr] = new Date().toISOString().split('T');
            let blob: Blob;
            let filename = `renovation-backup-${dateStr}-${projectMeta?.name ?? 'noname'}`;
            if (isCompressionSupported) {
                blob = await compressToGzip(JSON.stringify(state, null, 2));
                filename = `${filename}.json.gz`;
            } else {
                blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
                filename = `${filename}.json`;
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
    }, [projectMeta?.name, state]);

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
            createNewProject,
            renameProject,
            saveError,
            clearSaveError
        }),
        [
            state,
            dispatch,
            saveToFile,
            loadFromFile,
            projectMeta,
            needsProjectSelection,
            openProjectSelector,
            selectProject,
            createNewProject,
            renameProject,
            saveError,
            clearSaveError
        ]
    );

    return (
        <AppContext.Provider value={contextValue}>
            {needsProviderSelection && (
                <StorageProviderModal
                    availableProviders={availableProviders}
                    onSelectProvider={handleSelectProvider}
                />
            )}
            {!needsProviderSelection && needsProjectSelection && (
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
