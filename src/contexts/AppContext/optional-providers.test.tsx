import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import type { ProjectMeta } from '../../storage/types';
import { ACTIVE_PROJECT_KEY } from '../../storage/types';


// These imports must come AFTER vi.mock() so they pick up the mocked module.
import { AppProvider, useApp } from '.';


// ---------------------------------------------------------------------------
// Shared mock state — must be declared with vi.hoisted() so the vi.mock()
// factory (which is hoisted to the top of the file) can reference them.
// ---------------------------------------------------------------------------
const {
    mockSetProvider,
    mockProviderId,
    mockInitialize,
    mockListProjects,
    mockLoadProject,
    mockSaveProject
} = vi.hoisted(() => {
    const providerIdRef = { current: 'LS_OPFS' as string };
    const initializeFn = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const listProjectsFn = vi.fn<() => Promise<ProjectMeta[]>>().mockResolvedValue([]);
    const loadProjectFn = vi.fn().mockResolvedValue(null);
    const saveProjectFn = vi.fn().mockResolvedValue(undefined);
    const setProviderFn = vi.fn().mockImplementation((id: string) => {
        providerIdRef.current = id;
    });
    return {
        mockSetProvider: setProviderFn,
        mockProviderId: providerIdRef,
        mockInitialize: initializeFn,
        mockListProjects: listProjectsFn,
        mockLoadProject: loadProjectFn,
        mockSaveProject: saveProjectFn
    };
});

// Mock the whole storage module with hasOptionalProviders = true.
// The storageManager.provider getter always reads the latest mockProviderId.current.
vi.mock('../../storage', () => ({
    hasOptionalProviders: true,
    allProvidersReady: Promise.resolve(new Set(['GDRIVE'])),
    getAvailableProviders: (registeredIds: ReadonlySet<string>) => [
        {
            providerId: 'LS_OPFS',
            name: 'Local Storage',
            description: 'Store locally',
            icon: '💾',
            ready: true
        },
        {
            providerId: 'GDRIVE',
            name: 'Google Drive',
            description: 'Store in Drive',
            icon: '☁️',
            ready: registeredIds.has('GDRIVE'),
            inFlightLabel: 'Connecting…'
        }
    ],
    storageManager: {
        get provider() {
            return {
                id: mockProviderId.current,
                label: mockProviderId.current === 'GDRIVE' ? 'Google Drive' : 'Local Storage',
                initialize: mockInitialize,
                listProjects: mockListProjects,
                loadProject: mockLoadProject,
                saveProject: mockSaveProject,
                createProject: vi.fn().mockResolvedValue('new-id'),
                renameProject: vi.fn().mockResolvedValue(undefined),
                getProjectSize: vi.fn().mockResolvedValue(0)
            };
        },
        setProvider: mockSetProvider,
        get providers() {
            return mockProviderId.current === 'GDRIVE'
                ? [{ id: 'LS_OPFS' }, { id: 'GDRIVE' }]
                : [{ id: 'LS_OPFS' }];
        },
        addProvider: vi.fn(),
        hasProviderSelected: true
    }
}));


function wrapper({ children }: { children: ReactNode }) {
    return <AppProvider>{children}</AppProvider>;
}

// ---------------------------------------------------------------------------
// Optional provider selection flow
// ---------------------------------------------------------------------------

describe('AppContext – optional provider selection', () => {
    beforeEach(() => {
        localStorage.clear();
        mockProviderId.current = 'LS_OPFS';
        vi.clearAllMocks();
        mockInitialize.mockResolvedValue(undefined);
        mockListProjects.mockResolvedValue([]);
        mockLoadProject.mockResolvedValue(null);
        mockSaveProject.mockResolvedValue(undefined);
        mockSetProvider.mockImplementation((id: string) => {
            mockProviderId.current = id;
        });
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('renders StorageProviderModal on mount when optional providers are configured', () => {
        render(
            <AppProvider>
                <div />
            </AppProvider>
        );
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /choose storage/i })).toBeInTheDocument();
    });

    it('does NOT call initialize/listProjects on mount (deferred until provider is chosen)', () => {
        render(
            <AppProvider>
                <div />
            </AppProvider>
        );
        expect(mockInitialize).not.toHaveBeenCalled();
        expect(mockListProjects).not.toHaveBeenCalled();
    });

    it('selecting Local Storage dismisses the modal and calls initialize/listProjects', async () => {
        const user = userEvent.setup();
        render(
            <AppProvider>
                <div />
            </AppProvider>
        );

        await user.click(screen.getByRole('button', { name: /local storage/i }));

        await waitFor(() => {
            expect(screen.queryByRole('heading', { name: /choose storage/i })).not.toBeInTheDocument();
        });

        expect(mockInitialize).toHaveBeenCalledOnce();
        expect(mockListProjects).toHaveBeenCalledOnce();
    });

    it('selecting Local Storage does not set the active provider to GDRIVE', async () => {
        const user = userEvent.setup();
        render(
            <AppProvider>
                <div />
            </AppProvider>
        );

        await user.click(screen.getByRole('button', { name: /local storage/i }));

        await waitFor(() => {
            expect(screen.queryByRole('heading', { name: /choose storage/i })).not.toBeInTheDocument();
        });

        expect(mockSetProvider).not.toHaveBeenCalledWith('GDRIVE');
        expect(mockSetProvider).toHaveBeenCalledWith('LS_OPFS');
    });

    it('selecting Google Drive dismisses the modal after setProvider/initialize/listProjects', async () => {
        const user = userEvent.setup();
        render(
            <AppProvider>
                <div />
            </AppProvider>
        );

        // Wait for allProvidersReady so the GDrive button becomes enabled
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /google drive/i })).not.toBeDisabled();
        });

        await user.click(screen.getByRole('button', { name: /google drive/i }));

        await waitFor(() => {
            expect(screen.queryByRole('heading', { name: /choose storage/i })).not.toBeInTheDocument();
        });
        expect(mockInitialize).toHaveBeenCalledOnce();
        expect(mockListProjects).toHaveBeenCalledOnce();
    });

    it('shows an error in the modal when the GDrive provider is not registered', async () => {
        const user = userEvent.setup();
        // setProvider does nothing — provider id stays 'LS_OPFS', triggering the guard in AppContext
        mockSetProvider.mockImplementation(() => {
            // intentionally do not update mockProviderId — simulates a failed provider import
        });

        render(
            <AppProvider>
                <div />
            </AppProvider>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /google drive/i })).not.toBeDisabled();
        });

        await user.click(screen.getByRole('button', { name: /google drive/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/failed to load/i);
        });

        // Modal stays open — user can retry
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('shows an error alert when Local Storage initialization fails', async () => {
        const user = userEvent.setup();
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        });
        mockInitialize.mockRejectedValueOnce(new Error('disk quota exceeded'));

        render(
            <AppProvider>
                <div />
            </AppProvider>
        );

        await user.click(screen.getByRole('button', { name: /local storage/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/disk quota exceeded/i);
        });

        // Modal stays open — user can retry
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    // ── ACTIVE_PROJECT_KEY behaviour ────────────────────────────────────────

    it('does not write ACTIVE_PROJECT_KEY when GDrive provider is active', async () => {
        mockProviderId.current = 'GDRIVE';
        const mockProject = {
            meta: { id: 'p1', name: 'GDrive Project', lastModified: '2024-01-01T00:00:00.000Z' },
            rawData: {}
        };
        mockLoadProject.mockResolvedValueOnce(mockProject);

        const { result } = renderHook(() => useApp(), { wrapper });

        await act(async () => {
            await result.current.selectProject('p1');
        });

        expect(localStorage.getItem(ACTIVE_PROJECT_KEY)).toBeNull();
    });

    it('writes ACTIVE_PROJECT_KEY when local provider is active', async () => {
        mockProviderId.current = 'LS_OPFS';
        const mockProject = {
            meta: { id: 'p1', name: 'Local Project', lastModified: '2024-01-01T00:00:00.000Z' },
            rawData: {}
        };
        mockLoadProject.mockResolvedValueOnce(mockProject);

        const { result } = renderHook(() => useApp(), { wrapper });

        await act(async () => {
            await result.current.selectProject('p1');
        });

        expect(localStorage.getItem(ACTIVE_PROJECT_KEY)).toBe('p1');
    });
});
