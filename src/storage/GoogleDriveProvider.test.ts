import { GoogleDriveProvider } from './GoogleDriveProvider';


// ---------------------------------------------------------------------------
// Test helpers & mocks
// ---------------------------------------------------------------------------

const CLIENT_ID = 'test-client-id';
const NOW = '2024-06-01T10:00:00.000Z';

function makeRecord(name: string, lastModified = NOW) {
    return {
        meta: { name, lastModified },
        data: { notes: [], tasks: [], expenses: [], calendarEvents: [], budget: 0 }
    };
}

/** Set up a fake window.google.accounts.oauth2 that resolves immediately */
function mockGIS(accessToken = 'fake-access-token') {
    let storedCallback: ((response: { access_token: string }) => void) | null = null;

    const tokenClient = {
        requestAccessToken: vi.fn(() => {
            storedCallback?.({ access_token: accessToken });
        })
    };

    window.google = {
        accounts: {
            oauth2: {
                initTokenClient: vi.fn((config: { callback: (r: { access_token: string }) => void }) => {
                    storedCallback = config.callback;
                    return tokenClient;
                })
            }
        }
    };

    return tokenClient;
}

const FAKE_TOKEN = 'fake-access-token';

/** Convenience: build what google returns for a file list */
function driveFileList(files: object[]) {
    return Promise.resolve({
        ok: true,
        json: async () => ({ files })
    } as unknown as Response);
}

/** Convenience: build a media response (file content) */
function driveMedia(content: object) {
    return Promise.resolve({
        ok: true,
        json: async () => content
    } as unknown as Response);
}

/** An error response */
function driveError(status = 400) {
    return Promise.resolve({
        ok: false,
        status,
        statusText: 'Error'
    } as unknown as Response);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GoogleDriveProvider', () => {
    let provider: GoogleDriveProvider;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        provider = new GoogleDriveProvider(CLIENT_ID);
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        mockGIS();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
        // Clean up window.google
        delete window.google;
    });

    // ── id / label ────────────────────────────────────────────────────────

    it('has id "GDRIVE"', () => {
        expect(provider.id).toBe('GDRIVE');
    });

    it('has label "Google Drive"', () => {
        expect(provider.label).toBe('Google Drive');
    });

    // ── initialize ───────────────────────────────────────────────────────

    describe('initialize', () => {
        it('resolves and stores an access token when GIS is available', async () => {
            await expect(provider.initialize()).resolves.toBeUndefined();
        });

        it('uses the loaded GIS library if it is already on window', async () => {
            mockGIS(); // already set up in beforeEach – just ensure no script is appended
            const appendSpy = vi.spyOn(document.head, 'appendChild');
            await provider.initialize();
            // No new script tag should have been inserted (library was already present)
            const scriptCalls = appendSpy.mock.calls.filter(
                args => args[0] instanceof HTMLScriptElement
            );
            expect(scriptCalls).toHaveLength(0);
        });

        it('rejects when the GIS script fails to load', async () => {
            delete window.google; // remove so provider tries to load it
            const appendSpy = vi.spyOn(document.head, 'appendChild').mockImplementation(node => {
                if (node instanceof HTMLScriptElement) {
                    setTimeout(() => node.dispatchEvent(new Event('error')), 0);
                }
                return node;
            });

            await expect(provider.initialize()).rejects.toThrow(
                /failed to load google identity services/i
            );
            appendSpy.mockRestore();
        });

        it('rejects when requestAccessToken returns an error', async () => {
            type ErrorCb = (r: { access_token: string; error: string; error_description?: string }) => void;
            window.google = {
                accounts: {
                    oauth2: {
                        initTokenClient: vi.fn((config: { callback: ErrorCb }) => ({
                            requestAccessToken: vi.fn(() => {
                                config.callback({ access_token: '', error: 'access_denied', error_description: 'User denied' });
                            })
                        }))
                    }
                }
            };
            await expect(provider.initialize()).rejects.toThrow('User denied');
        });
    });

    // ── listProjects ─────────────────────────────────────────────────────

    describe('listProjects', () => {
        beforeEach(async () => {
            await provider.initialize();
        });

        it('returns an empty array when no files are present', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ files: [] })
            });
            await expect(provider.listProjects()).resolves.toEqual([]);
        });

        it('returns projects from appProperties when available (fast path)', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    files: [
                        {
                            id: 'gid1',
                            name: 'renovation-project-abc.json',
                            appProperties: { projectName: 'Kitchen', lastModified: NOW }
                        }
                    ]
                })
            });
            const projects = await provider.listProjects();
            expect(projects).toHaveLength(1);
            expect(projects[0]).toMatchObject({ id: 'abc', name: 'Kitchen', lastModified: NOW });
            // Fast path: only one fetch call (for the list)
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('fetches file content when appProperties are missing (slow path)', async () => {
            fetchMock
                .mockResolvedValueOnce(
                    driveFileList([{ id: 'gid1', name: 'renovation-project-abc.json' }])
                )
                .mockResolvedValueOnce(driveMedia(makeRecord('Bathroom')));

            const projects = await provider.listProjects();
            expect(projects).toHaveLength(1);
            expect(projects[0].name).toBe('Bathroom');
        });

        it('skips files with names that do not match the expected pattern', async () => {
            fetchMock.mockResolvedValueOnce(
                driveFileList([{ id: 'gid2', name: 'unrelated-file.txt' }])
            );
            await expect(provider.listProjects()).resolves.toEqual([]);
        });

        it('skips corrupted files (invalid JSON content)', async () => {
            fetchMock
                .mockResolvedValueOnce(
                    driveFileList([{ id: 'gid1', name: 'renovation-project-abc.json' }])
                )
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => {
                        throw new Error('Invalid JSON');
                    }
                });

            await expect(provider.listProjects()).resolves.toEqual([]);
        });

        it('sorts projects newest-first by lastModified', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    files: [
                        {
                            id: 'gid1',
                            name: 'renovation-project-p1.json',
                            appProperties: { projectName: 'Old', lastModified: '2024-01-01T00:00:00.000Z' }
                        },
                        {
                            id: 'gid2',
                            name: 'renovation-project-p2.json',
                            appProperties: { projectName: 'New', lastModified: '2024-06-01T00:00:00.000Z' }
                        }
                    ]
                })
            });
            const projects = await provider.listProjects();
            expect(projects[0].name).toBe('New');
            expect(projects[1].name).toBe('Old');
        });

        it('throws when not authenticated', async () => {
            const unauthProvider = new GoogleDriveProvider(CLIENT_ID);
            // Do NOT call initialize() — accessToken remains null
            await expect(unauthProvider.listProjects()).rejects.toThrow(/not authenticated/i);
        });
    });

    // ── loadProject ──────────────────────────────────────────────────────

    describe('loadProject', () => {
        beforeEach(async () => {
            await provider.initialize();
        });

        it('returns null when the project file does not exist in Drive', async () => {
            fetchMock.mockResolvedValueOnce(driveFileList([]));
            await expect(provider.loadProject('nonexistent')).resolves.toBeNull();
        });

        it('returns project data for a valid file', async () => {
            const record = makeRecord('My Project', NOW);
            fetchMock
                .mockResolvedValueOnce(
                    driveFileList([{ id: 'gid1', name: 'renovation-project-p1.json' }])
                )
                .mockResolvedValueOnce(driveMedia(record));

            const result = await provider.loadProject('p1');
            expect(result).not.toBeNull();
            expect(result?.meta.name).toBe('My Project');
            expect(result?.meta.id).toBe('p1');
        });

        it('returns null when file content is not a valid record', async () => {
            fetchMock
                .mockResolvedValueOnce(
                    driveFileList([{ id: 'gid1', name: 'renovation-project-p1.json' }])
                )
                .mockResolvedValueOnce(driveMedia({ invalid: true }));

            await expect(provider.loadProject('p1')).resolves.toBeNull();
        });

        it('returns null when the media fetch fails', async () => {
            fetchMock
                .mockResolvedValueOnce(
                    driveFileList([{ id: 'gid1', name: 'renovation-project-p1.json' }])
                )
                .mockResolvedValueOnce(driveError(500));

            await expect(provider.loadProject('p1')).resolves.toBeNull();
        });
    });

    // ── createProject ─────────────────────────────────────────────────────

    describe('createProject', () => {
        beforeEach(async () => {
            await provider.initialize();
        });

        it('returns a non-empty string id', async () => {
            fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'new-gid' }) });
            const id = await provider.createProject('New Project');
            expect(typeof id).toBe('string');
            expect(id).not.toBe('');
        });

        it('POSTs to the upload endpoint with multipart body', async () => {
            fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'new-gid' }) });
            await provider.createProject('Test');

            const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
            expect(url).toContain('/upload/drive/v3/files');
            expect((options.headers as Record<string, string>)['Content-Type']).toContain('multipart/related');
            expect(options.method).toBe('POST');
        });

        it('throws when the API returns an error', async () => {
            fetchMock.mockResolvedValueOnce(driveError(403));
            await expect(provider.createProject('Fail')).rejects.toThrow(/403/);
        });
    });

    // ── saveProject ───────────────────────────────────────────────────────

    describe('saveProject', () => {
        const FAKE_DATA = { notes: [], tasks: [], expenses: [], calendarEvents: [], budget: 42 };

        beforeEach(async () => {
            await provider.initialize();
        });

        it('PATCHes an existing file if it is found in Drive', async () => {
            fetchMock
                .mockResolvedValueOnce(
                    driveFileList([{ id: 'gid1', name: 'renovation-project-p1.json' }])
                )
                .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

            await expect(provider.saveProject('p1', 'My Project', FAKE_DATA)).resolves.toBeUndefined();

            const [url, options] = fetchMock.mock.calls[1] as [string, RequestInit];
            expect(options.method).toBe('PATCH');
            expect(url).toContain('gid1');
        });

        it('POSTs a new file when it does not exist yet', async () => {
            fetchMock
                .mockResolvedValueOnce(driveFileList([]))
                .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

            await expect(provider.saveProject('new-id', 'New', FAKE_DATA)).resolves.toBeUndefined();

            const [, options] = fetchMock.mock.calls[1] as [string, RequestInit];
            expect(options.method).toBe('POST');
        });

        it('throws when the PATCH request fails', async () => {
            fetchMock
                .mockResolvedValueOnce(
                    driveFileList([{ id: 'gid1', name: 'renovation-project-p1.json' }])
                )
                .mockResolvedValueOnce(driveError(500));

            await expect(provider.saveProject('p1', 'Name', FAKE_DATA)).rejects.toThrow(/500/);
        });
    });

    // ── renameProject ─────────────────────────────────────────────────────

    describe('renameProject', () => {
        beforeEach(async () => {
            await provider.initialize();
        });

        it('does nothing when the project file is not found', async () => {
            fetchMock.mockResolvedValueOnce(driveFileList([]));
            await expect(provider.renameProject('missing', 'New Name')).resolves.toBeUndefined();
            // Only one fetch call (listing)
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('updates file content and appProperties with the new name', async () => {
            const record = makeRecord('Old Name', NOW);
            fetchMock
                .mockResolvedValueOnce(
                    driveFileList([{ id: 'gid1', name: 'renovation-project-p1.json' }])
                )
                .mockResolvedValueOnce(driveMedia(record))
                .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

            await expect(provider.renameProject('p1', 'New Name')).resolves.toBeUndefined();

            // Third fetch should be a PATCH with the new name in the body
            const [, options] = fetchMock.mock.calls[2] as [string, RequestInit];
            expect(options.method).toBe('PATCH');
            expect(options.body as string).toContain('New Name');
        });

        it('does nothing when the file content is an invalid record', async () => {
            fetchMock
                .mockResolvedValueOnce(
                    driveFileList([{ id: 'gid1', name: 'renovation-project-p1.json' }])
                )
                .mockResolvedValueOnce(driveMedia({ bad: 'data' }));

            await expect(provider.renameProject('p1', 'New Name')).resolves.toBeUndefined();
            // Only 2 fetches: list + media read (no PATCH because record is invalid)
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });
    });

    // ── getProjectSize ────────────────────────────────────────────────────

    describe('getProjectSize', () => {
        beforeEach(async () => {
            await provider.initialize();
        });

        it('returns 0 when the project is not found', async () => {
            fetchMock.mockResolvedValueOnce(driveFileList([]));
            await expect(provider.getProjectSize('missing')).resolves.toBe(0);
        });

        it('returns 0 when the file entry has no size', async () => {
            fetchMock.mockResolvedValueOnce(
                driveFileList([{ id: 'gid1', name: 'renovation-project-p1.json' }])
            );
            await expect(provider.getProjectSize('p1')).resolves.toBe(0);
        });

        it('returns the numeric size when present', async () => {
            fetchMock.mockResolvedValueOnce(
                driveFileList([{ id: 'gid1', name: 'renovation-project-p1.json', size: '1234' }])
            );
            await expect(provider.getProjectSize('p1')).resolves.toBe(1234);
        });
    });

    // ── Authorization header ──────────────────────────────────────────────

    it('includes the Authorization header in every API request', async () => {
        await provider.initialize();
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ files: [] })
        });

        await provider.listProjects();

        const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect((options.headers as Record<string, string>).Authorization).toBe(
            `Bearer ${FAKE_TOKEN}`
        );
    });

    it('throws when any API call is made before initialize()', async () => {
        const unauthProvider = new GoogleDriveProvider(CLIENT_ID);
        await expect(unauthProvider.loadProject('x')).rejects.toThrow(/not authenticated/i);
    });
});
