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
function driveFileList(files: object[], nextPageToken?: string) {
    return Promise.resolve({
        ok: true,
        json: async () => ({ files, ...nextPageToken !== undefined && { nextPageToken } })
    } as unknown as Response);
}

/** Convenience: build a single-file search result (for getFileInfo) */
function driveFileSearch(file: object | null) {
    return driveFileList(file === null ? [] : [file]);
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

/** A 401 Unauthorized response */
function drive401() {
    return Promise.resolve({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
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

        it('collects files across multiple pages using nextPageToken', async () => {
            // Page 1 returns one file and a nextPageToken
            fetchMock
                .mockResolvedValueOnce(
                    driveFileList(
                        [{ id: 'gid1', name: 'renovation-project-p1.json', appProperties: { projectName: 'P1', lastModified: NOW } }],
                        'token-page-2'
                    )
                )
                // Page 2 returns the second file and no more pages
                .mockResolvedValueOnce(
                    driveFileList([{ id: 'gid2', name: 'renovation-project-p2.json', appProperties: { projectName: 'P2', lastModified: NOW } }])
                );

            const projects = await provider.listProjects();
            expect(projects).toHaveLength(2);
            expect(fetchMock).toHaveBeenCalledTimes(2);
            // Second call should include the pageToken
            const [secondUrl] = fetchMock.mock.calls[1] as [string];
            expect(secondUrl).toContain('pageToken=token-page-2');
        });

        it('includes pageSize=1000 in the list query', async () => {
            fetchMock.mockResolvedValueOnce(driveFileList([]));
            await provider.listProjects();
            const [url] = fetchMock.mock.calls[0] as [string];
            expect(url).toContain('pageSize=1000');
        });
    });

    // ── loadProject ──────────────────────────────────────────────────────

    describe('loadProject', () => {
        beforeEach(async () => {
            await provider.initialize();
        });

        it('returns null when the project file does not exist in Drive', async () => {
            // getFileInfo does a targeted name-query; return empty list
            fetchMock.mockResolvedValueOnce(driveFileSearch(null));
            await expect(provider.loadProject('nonexistent')).resolves.toBeNull();
        });

        it('returns project data for a valid file', async () => {
            const record = makeRecord('My Project', NOW);
            fetchMock
                .mockResolvedValueOnce(
                    driveFileSearch({ id: 'gid1', name: 'renovation-project-p1.json' })
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
                    driveFileSearch({ id: 'gid1', name: 'renovation-project-p1.json' })
                )
                .mockResolvedValueOnce(driveMedia({ invalid: true }));

            await expect(provider.loadProject('p1')).resolves.toBeNull();
        });

        it('returns null when the media fetch fails', async () => {
            fetchMock
                .mockResolvedValueOnce(
                    driveFileSearch({ id: 'gid1', name: 'renovation-project-p1.json' })
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

        it('uses a unique multipart boundary for each call', async () => {
            fetchMock
                .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
                .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

            await provider.createProject('A');
            await provider.createProject('B');

            const [, opts1] = fetchMock.mock.calls[0] as [string, RequestInit];
            const [, opts2] = fetchMock.mock.calls[1] as [string, RequestInit];

            const ct1 = (opts1.headers as Record<string, string>)['Content-Type'] ?? '';
            const ct2 = (opts2.headers as Record<string, string>)['Content-Type'] ?? '';
            expect(ct1).toContain('boundary=');
            expect(ct2).toContain('boundary=');
            // Boundaries must differ between calls
            expect(ct1).not.toBe(ct2);
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
                    driveFileSearch({ id: 'gid1', name: 'renovation-project-p1.json' })
                )
                .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

            await expect(provider.saveProject('p1', 'My Project', FAKE_DATA)).resolves.toBeUndefined();

            const [url, options] = fetchMock.mock.calls[1] as [string, RequestInit];
            expect(options.method).toBe('PATCH');
            expect(url).toContain('gid1');
        });

        it('POSTs a new file when it does not exist yet', async () => {
            fetchMock
                .mockResolvedValueOnce(driveFileSearch(null))
                .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

            await expect(provider.saveProject('new-id', 'New', FAKE_DATA)).resolves.toBeUndefined();

            const [, options] = fetchMock.mock.calls[1] as [string, RequestInit];
            expect(options.method).toBe('POST');
        });

        it('throws when the PATCH request fails', async () => {
            fetchMock
                .mockResolvedValueOnce(
                    driveFileSearch({ id: 'gid1', name: 'renovation-project-p1.json' })
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
            fetchMock.mockResolvedValueOnce(driveFileSearch(null));
            await expect(provider.renameProject('missing', 'New Name')).resolves.toBeUndefined();
            // Only one fetch call (getFileInfo targeted query)
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('updates file content and appProperties with the new name', async () => {
            const record = makeRecord('Old Name', NOW);
            fetchMock
                .mockResolvedValueOnce(
                    driveFileSearch({ id: 'gid1', name: 'renovation-project-p1.json' })
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
                    driveFileSearch({ id: 'gid1', name: 'renovation-project-p1.json' })
                )
                .mockResolvedValueOnce(driveMedia({ bad: 'data' }));

            await expect(provider.renameProject('p1', 'New Name')).resolves.toBeUndefined();
            // Only 2 fetches: getFileInfo + media read (no PATCH because record is invalid)
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });
    });

    // ── getProjectSize ────────────────────────────────────────────────────

    describe('getProjectSize', () => {
        beforeEach(async () => {
            await provider.initialize();
        });

        it('returns 0 when the project is not found', async () => {
            fetchMock.mockResolvedValueOnce(driveFileSearch(null));
            await expect(provider.getProjectSize('missing')).resolves.toBe(0);
        });

        it('returns 0 when the file entry has no size', async () => {
            fetchMock.mockResolvedValueOnce(
                driveFileSearch({ id: 'gid1', name: 'renovation-project-p1.json' })
            );
            await expect(provider.getProjectSize('p1')).resolves.toBe(0);
        });

        it('returns the numeric size when present', async () => {
            fetchMock.mockResolvedValueOnce(
                driveFileSearch({ id: 'gid1', name: 'renovation-project-p1.json', size: '1234' })
            );
            await expect(provider.getProjectSize('p1')).resolves.toBe(1234);
        });
    });

    // ── getFileInfo targeted query ────────────────────────────────────────

    describe('getFileInfo (targeted query)', () => {
        beforeEach(async () => {
            await provider.initialize();
        });

        it('queries Drive with an exact name match (q=name=…)', async () => {
            fetchMock.mockResolvedValueOnce(driveFileSearch(null));
            await provider.loadProject('my-project-id');

            const [url] = fetchMock.mock.calls[0] as [string];
            // URLSearchParams URL-encodes the q= value; decode before asserting
            const decodedUrl = decodeURIComponent(url);
            // The query should use exact name match, not contains
            expect(decodedUrl).toContain("q=name='");
            expect(decodedUrl).toContain('renovation-project-my-project-id.json');
        });

        it('uses pageSize=1 in the targeted query', async () => {
            fetchMock.mockResolvedValueOnce(driveFileSearch(null));
            await provider.loadProject('any-id');

            const [url] = fetchMock.mock.calls[0] as [string];
            const decodedUrl = decodeURIComponent(url);
            expect(decodedUrl).toContain('pageSize=1');
        });

        it('escapes special characters in project IDs within the query', async () => {
            fetchMock.mockResolvedValueOnce(driveFileSearch(null));
            // Project id with a single-quote (edge case); should not break the q= parameter
            await provider.loadProject("tricky'id");

            const [url] = fetchMock.mock.calls[0] as [string];
            // URLSearchParams URL-encodes special chars; decode before asserting the Drive query
            const decodedUrl = decodeURIComponent(url);
            // The single-quote in the project ID must be backslash-escaped so the Drive query is valid
            expect(decodedUrl).toContain("renovation-project-tricky\\'id.json");
        });
    });

    // ── Token expiry / 401 handling ───────────────────────────────────────

    describe('token expiry (401 handling)', () => {
        beforeEach(async () => {
            await provider.initialize();
        });

        it('retries the request with a new token after a 401', async () => {
            // First list call returns 401
            fetchMock
                .mockResolvedValueOnce(drive401())
                // After silent token refresh, retry succeeds
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ files: [] })
                });

            await expect(provider.listProjects()).resolves.toEqual([]);
            // Two fetch calls total: initial 401, then retry
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('calls requestAccessToken again for silent refresh after a 401', async () => {
            // The initTokenClient mock was called once during initialize() (in beforeEach).
            // Get the token client it returned so we can assert against its requestAccessToken.
            const initMock = window.google!.accounts.oauth2.initTokenClient as ReturnType<typeof vi.fn>;
            const cachedTokenClient = initMock.mock.results[0]?.value as { requestAccessToken: ReturnType<typeof vi.fn> };

            fetchMock
                .mockResolvedValueOnce(drive401())
                .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }) });

            await provider.listProjects();

            // requestAccessToken: once during initialize() + once for silent refresh
            expect(cachedTokenClient.requestAccessToken).toHaveBeenCalledTimes(2);
            // Silent refresh must pass an empty prompt to avoid user interaction
            expect(cachedTokenClient.requestAccessToken).toHaveBeenLastCalledWith({ prompt: '' });
        });

        it('throws a session-expired error when silent refresh fails', async () => {
            // Retrieve the token client and its config (including error_callback) that were
            // captured by the initTokenClient mock during initialize() in beforeEach.
            const initMock = window.google!.accounts.oauth2.initTokenClient as ReturnType<typeof vi.fn>;
            const tokenClientConfig = initMock.mock.calls[0]?.[0] as { error_callback?: (e: { message: string; type: string }) => void };
            const cachedTokenClient = initMock.mock.results[0]?.value as { requestAccessToken: ReturnType<typeof vi.fn> };

            // Make the next requestAccessToken call invoke error_callback (simulates failed silent refresh)
            cachedTokenClient.requestAccessToken.mockImplementationOnce(() => {
                tokenClientConfig.error_callback?.({ message: 'silent_refresh_failed', type: 'token_error' });
            });

            fetchMock.mockResolvedValueOnce(drive401());

            await expect(provider.listProjects()).rejects.toThrow(/session expired/i);
        });

        it('does not retry on non-401 errors', async () => {
            fetchMock.mockResolvedValueOnce(driveError(403));
            await expect(provider.listProjects()).rejects.toThrow(/403/);
            // Only one fetch call – no retry for 403
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('deduplicates concurrent token requests when multiple 401s race', async () => {
            // In production the GIS library calls back asynchronously (user interaction needed),
            // so two concurrent requests hitting 401 should share one token-refresh call.
            // We simulate this by making the silent-refresh mock NOT call back immediately,
            // then manually triggering it so both waiters share the same resolved token.
            const initMock = window.google!.accounts.oauth2.initTokenClient as ReturnType<typeof vi.fn>;
            const cachedTokenClient = initMock.mock.results[0]?.value as { requestAccessToken: ReturnType<typeof vi.fn> };
            const config = initMock.mock.calls[0]?.[0] as { callback: (r: { access_token: string }) => void };

            let silentRefreshCount = 0;
            // Use an object to avoid TypeScript's control-flow narrowing on the let binding
            const refreshRef: { fn: (() => void) | null } = { fn: null };

            cachedTokenClient.requestAccessToken.mockImplementation((opts?: { prompt?: string }) => {
                if (opts?.prompt === '') {
                    // Silent-refresh path: don't call back yet (simulates async GIS flow)
                    silentRefreshCount++;
                    refreshRef.fn = () => config.callback({ access_token: 'refreshed-token' });
                } else {
                    // Interactive path (initialize): call back immediately as before
                    config.callback({ access_token: 'fake-access-token' });
                }
            });

            // Both list calls will get 401; retry fetches succeed
            fetchMock
                .mockResolvedValue(drive401()); // first two calls: 401; retries use the resolved value below

            // Start both requests — both hit 401 and both will call requestNewToken('')
            const p1 = provider.listProjects();
            const p2 = provider.listProjects();

            // Yield to let both promises hit the 401 and call requestNewToken('') before
            // the refresh resolves, so the second call can de-duplicate onto the first.
            await new Promise<void>(r => {
                setTimeout(r, 0);
            });

            // Swap mock so retry fetches succeed
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({ files: [] })
            } as unknown as Response);

            // Now resolve the token refresh – both callers should get the same token
            refreshRef.fn?.();

            const [r1, r2] = await Promise.all([p1, p2]);
            expect(r1).toEqual([]);
            expect(r2).toEqual([]);

            // Only one silent-refresh call despite two concurrent 401 retries
            expect(silentRefreshCount).toBe(1);
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

    // ── isStoredProjectRecord validation ─────────────────────────────────

    describe('record validation (isStoredProjectRecord)', () => {
        beforeEach(async () => {
            await provider.initialize();
        });

        it('accepts a well-formed record', async () => {
            fetchMock
                .mockResolvedValueOnce(driveFileSearch({ id: 'f1', name: 'renovation-project-abc.json' }))
                .mockResolvedValueOnce(driveMedia(makeRecord('MyProject')));
            const result = await provider.loadProject('abc');
            expect(result).not.toBeNull();
            expect(result?.meta.name).toBe('MyProject');
        });

        it('rejects a record where meta.name is missing', async () => {
            const badRecord = { meta: { lastModified: NOW }, data: {} };
            fetchMock
                .mockResolvedValueOnce(driveFileSearch({ id: 'f1', name: 'renovation-project-abc.json' }))
                .mockResolvedValueOnce(driveMedia(badRecord));
            const result = await provider.loadProject('abc');
            expect(result).toBeNull();
        });

        it('rejects a record where meta.name is not a string', async () => {
            const badRecord = { meta: { name: 42, lastModified: NOW }, data: {} };
            fetchMock
                .mockResolvedValueOnce(driveFileSearch({ id: 'f1', name: 'renovation-project-abc.json' }))
                .mockResolvedValueOnce(driveMedia(badRecord));
            const result = await provider.loadProject('abc');
            expect(result).toBeNull();
        });

        it('rejects a record where meta.lastModified is missing', async () => {
            const badRecord = { meta: { name: 'Project' }, data: {} };
            fetchMock
                .mockResolvedValueOnce(driveFileSearch({ id: 'f1', name: 'renovation-project-abc.json' }))
                .mockResolvedValueOnce(driveMedia(badRecord));
            const result = await provider.loadProject('abc');
            expect(result).toBeNull();
        });

        it('rejects a record where meta.lastModified is not a string', async () => {
            const badRecord = { meta: { name: 'Project', lastModified: 12345 }, data: {} };
            fetchMock
                .mockResolvedValueOnce(driveFileSearch({ id: 'f1', name: 'renovation-project-abc.json' }))
                .mockResolvedValueOnce(driveMedia(badRecord));
            const result = await provider.loadProject('abc');
            expect(result).toBeNull();
        });

        it('rejects a record with no meta property', async () => {
            const badRecord = { data: {} };
            fetchMock
                .mockResolvedValueOnce(driveFileSearch({ id: 'f1', name: 'renovation-project-abc.json' }))
                .mockResolvedValueOnce(driveMedia(badRecord));
            const result = await provider.loadProject('abc');
            expect(result).toBeNull();
        });
    });
});
