import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AppProvider } from '../../contexts/AppContext';
import { ACTIVE_PROJECT_KEY, STORAGE_KEY_PREFIX } from '../../storage/types';
import type { AppData } from '../../types';

import SaveLoadButtons, { formatBytes, formatRelativeTime } from '.';


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Wrapper({ children }: { children: ReactNode }) {
    return (
        <AppProvider>
            <MemoryRouter>
                {children}
            </MemoryRouter>
        </AppProvider>
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SaveLoadButtons', () => {
    beforeEach(() => {
        localStorage.clear();
        // Set up a default project so SaveLoadButtons has an active project to work with
        localStorage.setItem(
            `${STORAGE_KEY_PREFIX}test-project-id`,
            JSON.stringify({ meta: { name: 'Test', lastModified: '2024-01-01T00:00:00.000Z' }, data: { notes: [], tasks: [], expenses: [], calendarEvents: [], budget: 0 } })
        );
        localStorage.setItem(ACTIVE_PROJECT_KEY, 'test-project-id');
        vi.stubGlobal('alert', vi.fn());
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
        });
    });

    afterEach(() => {
        localStorage.clear();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    // ── Presence ──────────────────────────────────────────────────────────

    it('renders the 💾 Save button', () => {
        render(<SaveLoadButtons />, { wrapper: Wrapper });
        expect(screen.getByRole('button', { name: /💾 save/i })).toBeInTheDocument();
    });

    it('renders the 📂 Load button', () => {
        render(<SaveLoadButtons />, { wrapper: Wrapper });
        expect(screen.getByRole('button', { name: /📂 load/i })).toBeInTheDocument();
    });

    // ── Save button ───────────────────────────────────────────────────────

    it('clicking Save completes: either creates a download URL (success) or shows an alert (compression unavailable)', async () => {
        const user = userEvent.setup();
        render(<SaveLoadButtons />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /💾 save/i }));

        // Wait for async save to complete
        await new Promise(r => setTimeout(r, 50));

        const saved = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls.length > 0;
        const alerted = (window.alert as ReturnType<typeof vi.fn>).mock.calls.length > 0;
        expect(saved || alerted).toBe(true);
    });

    // ── Load button ───────────────────────────────────────────────────────

    it('clicking Load triggers a click on the file input', async () => {
        const user = userEvent.setup();
        const { container } = render(<SaveLoadButtons />, { wrapper: Wrapper });

        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
        expect(fileInput).toBeInTheDocument();

        const clickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => {
        });

        await user.click(screen.getByRole('button', { name: /📂 load/i }));

        expect(clickSpy).toHaveBeenCalled();
    });

    // ── handleFileChange with valid JSON ──────────────────────────────────

    it('loads valid JSON file → state updated in localStorage', async () => {
        const data: AppData = {
            notes: [],
            tasks: [],
            expenses: [],
            calendarEvents: [],
            budget: 77777
        };
        const file = new File([JSON.stringify(data)], 'backup.json', { type: 'application/json' });

        const { container } = render(<SaveLoadButtons />, { wrapper: Wrapper });
        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

        Object.defineProperty(fileInput, 'files', {
            value: [file],
            configurable: true
        });
        fireEvent.change(fileInput);

        await waitFor(() => {
            const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}test-project-id`);
            const stored = JSON.parse(raw ?? '{}') as { data: AppData };
            expect(stored.data.budget).toBe(77777);
        });
    });

    // ── handleFileChange with no file ─────────────────────────────────────

    it('no crash when file input changes with no file selected', () => {
        const { container } = render(<SaveLoadButtons />, { wrapper: Wrapper });
        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

        expect(() => {
            fireEvent.change(fileInput, { target: { files: [] } });
        }).not.toThrow();
    });

    // ── handleFileChange with invalid JSON ────────────────────────────────

    it('shows alert when file contains invalid JSON', async () => {
        const file = new File(['not-valid-json'], 'backup.json', { type: 'application/json' });
        const { container } = render(<SaveLoadButtons />, { wrapper: Wrapper });
        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

        Object.defineProperty(fileInput, 'files', {
            value: [file],
            configurable: true
        });
        fireEvent.change(fileInput);

        await waitFor(() => {
            expect(window.alert).toHaveBeenCalled();
        });
    });

    // ── Deployment info ────────────────────────────────────────────────────────────────────────────

    describe('deployment info', () => {
        afterEach(() => {
            vi.unstubAllEnvs();
        });

        it('is not rendered when no env vars are set', () => {
            render(<SaveLoadButtons />, { wrapper: Wrapper });
            expect(screen.queryByText('Commit:')).not.toBeInTheDocument();
            expect(screen.queryByText('Deployment:')).not.toBeInTheDocument();
            expect(screen.queryByText('Env:')).not.toBeInTheDocument();
            expect(screen.queryByText('Build date:')).not.toBeInTheDocument();
        });

        it('shows Env: row when VITE_VERCEL_ENV is set', () => {
            vi.stubEnv('VITE_VERCEL_ENV', 'production');
            render(<SaveLoadButtons />, { wrapper: Wrapper });

            expect(screen.getByText('Env:')).toBeInTheDocument();
            expect(screen.getByText('production')).toBeInTheDocument();
        });

        it('shows truncated SHA with full SHA as title when only VITE_VERCEL_GIT_COMMIT_SHA is set', () => {
            const sha = 'abc1234567890abcdef';
            vi.stubEnv('VITE_VERCEL_GIT_COMMIT_SHA', sha);
            render(<SaveLoadButtons />, { wrapper: Wrapper });

            expect(screen.getByText('Commit:')).toBeInTheDocument();
            const shaSpan = screen.getByTitle(sha);
            expect(shaSpan).toBeInTheDocument();
            expect(shaSpan).toHaveTextContent('abc1234');
        });

        it('shows deployment ID with Deployment: label when only VITE_VERCEL_DEPLOYMENT_ID is set', () => {
            vi.stubEnv('VITE_VERCEL_DEPLOYMENT_ID', 'dpl_test123');
            render(<SaveLoadButtons />, { wrapper: Wrapper });

            expect(screen.getByText('Deployment:')).toBeInTheDocument();
            const deploymentEl = screen.getByTitle('dpl_test123');
            expect(deploymentEl).toBeInTheDocument();
            expect(deploymentEl).toHaveTextContent('dpl_test123');
        });

        it('shows full deployment ID without truncation', () => {
            vi.stubEnv('VITE_VERCEL_DEPLOYMENT_ID', 'dpl_verylongdeploymentid');
            render(<SaveLoadButtons />, { wrapper: Wrapper });

            const deploymentEl = screen.getByTitle('dpl_verylongdeploymentid');
            expect(deploymentEl).toHaveTextContent('dpl_verylongdeploymentid');
            expect(deploymentEl).not.toHaveTextContent('\u2026');
        });

        it('shows SHA as a link to the commit when git provider env vars are set', () => {
            const sha = 'abc1234567890abcdef';
            vi.stubEnv('VITE_VERCEL_GIT_COMMIT_SHA', sha);
            vi.stubEnv('VITE_VERCEL_GIT_PROVIDER', 'github');
            vi.stubEnv('VITE_VERCEL_GIT_REPO_OWNER', 'owner');
            vi.stubEnv('VITE_VERCEL_GIT_REPO_SLUG', 'repo');
            render(<SaveLoadButtons />, { wrapper: Wrapper });

            const link = screen.getByRole('link', { name: /abc1234/i });
            expect(link).toHaveAttribute('href', `https://github.com/owner/repo/commit/${sha}`);
            expect(link).toHaveAttribute('title', sha);
        });

        it('shows SHA as a link with GitLab /-/commit URL pattern when provider is gitlab', () => {
            const sha = 'abc1234567890abcdef';
            vi.stubEnv('VITE_VERCEL_GIT_COMMIT_SHA', sha);
            vi.stubEnv('VITE_VERCEL_GIT_PROVIDER', 'gitlab');
            vi.stubEnv('VITE_VERCEL_GIT_REPO_OWNER', 'owner');
            vi.stubEnv('VITE_VERCEL_GIT_REPO_SLUG', 'repo');
            render(<SaveLoadButtons />, { wrapper: Wrapper });

            const link = screen.getByRole('link', { name: /abc1234/i });
            expect(link).toHaveAttribute('href', `https://gitlab.com/owner/repo/-/commit/${sha}`);
        });

        it('shows SHA as a plain span (not a link) when git provider env vars are absent', () => {
            const sha = 'abc1234567890abcdef';
            vi.stubEnv('VITE_VERCEL_GIT_COMMIT_SHA', sha);
            render(<SaveLoadButtons />, { wrapper: Wrapper });

            expect(screen.queryByRole('link')).not.toBeInTheDocument();
            expect(screen.getByTitle(sha)).toHaveTextContent('abc1234');
        });

        it('shows deployment as a link to Vercel dashboard when deploymentId starts with dpl_', () => {
            vi.stubEnv('VITE_VERCEL_PROJECT', 'bartosz-ds-projects/renovation');
            vi.stubEnv('VITE_VERCEL_DEPLOYMENT_ID', 'dpl_abc123xyz');
            render(<SaveLoadButtons />, { wrapper: Wrapper });

            const link = screen.getByRole('link', { name: /dpl_abc123xyz/i });
            expect(link).toHaveAttribute('href', 'https://vercel.com/bartosz-ds-projects/renovation/abc123xyz');
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        });

        it('shows deployment as a plain span (not a link) when deploymentId does not start with dpl_', () => {
            vi.stubEnv('VITE_VERCEL_DEPLOYMENT_ID', 'custom_deploy_id');
            render(<SaveLoadButtons />, { wrapper: Wrapper });

            expect(screen.queryByRole('link')).not.toBeInTheDocument();
            expect(screen.getByTitle('custom_deploy_id')).toHaveTextContent('custom_deploy_id');
        });

        it('shows deployment as a plain span (not a link) when VITE_VERCEL_PROJECT is absent', () => {
            vi.stubEnv('VITE_VERCEL_DEPLOYMENT_ID', 'dpl_abc123xyz');
            render(<SaveLoadButtons />, { wrapper: Wrapper });

            expect(screen.queryByRole('link')).not.toBeInTheDocument();
            expect(screen.getByTitle('dpl_abc123xyz')).toHaveTextContent('dpl_abc123xyz');
        });

        it('shows Build date: row when VITE_BUILD_DATE is set', () => {
            vi.stubEnv('VITE_BUILD_DATE', '2024-01-15T12:00:00.000Z');
            render(<SaveLoadButtons />, { wrapper: Wrapper });

            expect(screen.getByText('Build date:')).toBeInTheDocument();
            const buildDateSpan = screen.getByTitle('2024-01-15T12:00:00.000Z');
            expect(buildDateSpan).toBeInTheDocument();
            expect(buildDateSpan).toHaveTextContent(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
        });

        it('shows changelog link pointing to GitHub releases when provider is github', () => {
            vi.stubEnv('VITE_VERCEL_GIT_PROVIDER', 'github');
            vi.stubEnv('VITE_VERCEL_GIT_REPO_OWNER', 'owner');
            vi.stubEnv('VITE_VERCEL_GIT_REPO_SLUG', 'repo');
            render(<SaveLoadButtons />, { wrapper: Wrapper });

            const link = screen.getByRole('link', { name: /changelog/i });
            expect(link).toHaveAttribute('href', 'https://github.com/owner/repo/releases');
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        });

        it('shows changelog link pointing to GitLab releases when provider is gitlab', () => {
            vi.stubEnv('VITE_VERCEL_GIT_PROVIDER', 'gitlab');
            vi.stubEnv('VITE_VERCEL_GIT_REPO_OWNER', 'owner');
            vi.stubEnv('VITE_VERCEL_GIT_REPO_SLUG', 'repo');
            render(<SaveLoadButtons />, { wrapper: Wrapper });

            const link = screen.getByRole('link', { name: /changelog/i });
            expect(link).toHaveAttribute('href', 'https://gitlab.com/owner/repo/-/releases');
        });

        it('does not show changelog link when provider is bitbucket (no releases page)', () => {
            vi.stubEnv('VITE_VERCEL_GIT_PROVIDER', 'bitbucket');
            vi.stubEnv('VITE_VERCEL_GIT_REPO_OWNER', 'owner');
            vi.stubEnv('VITE_VERCEL_GIT_REPO_SLUG', 'repo');
            render(<SaveLoadButtons />, { wrapper: Wrapper });

            expect(screen.queryByRole('link', { name: /changelog/i })).not.toBeInTheDocument();
        });

        it('does not show changelog link when git provider env vars are absent', () => {
            vi.stubEnv('VITE_VERCEL_GIT_COMMIT_SHA', 'abc1234567890abcdef');
            render(<SaveLoadButtons />, { wrapper: Wrapper });

            expect(screen.queryByRole('link', { name: /changelog/i })).not.toBeInTheDocument();
        });

        it('does not show changelog link when provider is unknown', () => {
            vi.stubEnv('VITE_VERCEL_GIT_PROVIDER', 'azure');
            vi.stubEnv('VITE_VERCEL_GIT_REPO_OWNER', 'owner');
            vi.stubEnv('VITE_VERCEL_GIT_REPO_SLUG', 'repo');
            render(<SaveLoadButtons />, { wrapper: Wrapper });

            expect(screen.queryByRole('link', { name: /changelog/i })).not.toBeInTheDocument();
        });
    });
});

// ---------------------------------------------------------------------------
// formatBytes / formatRelativeTime helpers (imported directly)
// ---------------------------------------------------------------------------

describe('formatBytes', () => {
    it('formats bytes below 1024 as "N B"', () => {
        expect(formatBytes(0)).toBe('0 B');
        expect(formatBytes(512)).toBe('512 B');
        expect(formatBytes(1023)).toBe('1023 B');
    });

    it('formats bytes in the KB range', () => {
        expect(formatBytes(1024)).toBe('1.0 KB');
        expect(formatBytes(2048)).toBe('2.0 KB');
        expect(formatBytes(1024 * 1023)).toBe('1023.0 KB');
    });

    it('formats bytes in the MB range', () => {
        expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
        expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB');
    });
});

describe('formatRelativeTime', () => {
    const baseNow = new Date('2024-06-01T12:00:00.000Z').getTime();

    it('returns "just now" for less than 60 seconds', () => {
        const iso = new Date(baseNow - 30_000).toISOString();
        expect(formatRelativeTime(iso, baseNow)).toBe('just now');
    });

    it('returns "just now" for 0 seconds', () => {
        const iso = new Date(baseNow).toISOString();
        expect(formatRelativeTime(iso, baseNow)).toBe('just now');
    });

    it('returns "N min ago" for 1-59 minutes', () => {
        const iso2m = new Date(baseNow - (2 * 60_000)).toISOString();
        expect(formatRelativeTime(iso2m, baseNow)).toBe('2 min ago');

        const iso59m = new Date(baseNow - (59 * 60_000)).toISOString();
        expect(formatRelativeTime(iso59m, baseNow)).toBe('59 min ago');
    });

    it('returns "N h ago" for 1-23 hours', () => {
        const iso1h = new Date(baseNow - (60 * 60_000)).toISOString();
        expect(formatRelativeTime(iso1h, baseNow)).toBe('1 h ago');

        const iso23h = new Date(baseNow - (23 * 60 * 60_000)).toISOString();
        expect(formatRelativeTime(iso23h, baseNow)).toBe('23 h ago');
    });

    it('returns a locale date string for 24+ hours', () => {
        const iso = new Date(baseNow - (24 * 60 * 60_000)).toISOString();
        const result = formatRelativeTime(iso, baseNow);
        // Should be a non-empty string that is NOT "N min ago" or "N h ago"
        expect(result).not.toMatch(/ago/);
        expect(result.length).toBeGreaterThan(0);
    });
});

// ---------------------------------------------------------------------------
// Project info section and rename input
// ---------------------------------------------------------------------------

describe('SaveLoadButtons – project info', () => {
    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem(
            `${STORAGE_KEY_PREFIX}test-project-id`,
            JSON.stringify({ meta: { name: 'My Reno', lastModified: new Date().toISOString() }, data: { notes: [], tasks: [], expenses: [], calendarEvents: [], budget: 0 } })
        );
        localStorage.setItem(ACTIVE_PROJECT_KEY, 'test-project-id');
        vi.stubGlobal('alert', vi.fn());
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
        });
    });

    afterEach(() => {
        localStorage.clear();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('shows the project name', () => {
        render(<SaveLoadButtons />, { wrapper: Wrapper });
        expect(screen.getByText('My Reno')).toBeInTheDocument();
    });

    it('shows the 🔄 switch project button', () => {
        render(<SaveLoadButtons />, { wrapper: Wrapper });
        expect(screen.getByRole('button', { name: /switch project/i })).toBeInTheDocument();
    });

    it('shows "just now" for a recently saved project', () => {
        render(<SaveLoadButtons />, { wrapper: Wrapper });
        expect(screen.getByText(/just now/i)).toBeInTheDocument();
    });

    it('clicking project name enters rename mode and shows an input', async () => {
        const user = userEvent.setup();
        render(<SaveLoadButtons />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: 'My Reno' }));

        expect(screen.getByRole('textbox', { name: /project name/i })).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /project name/i })).toHaveValue('My Reno');
    });

    it('committing a new name on Enter saves it', async () => {
        const user = userEvent.setup();
        render(<SaveLoadButtons />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: 'My Reno' }));

        const input = screen.getByRole('textbox', { name: /project name/i });
        await user.clear(input);
        await user.type(input, 'Updated Name');
        await user.keyboard('{Enter}');

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Updated Name' })).toBeInTheDocument();
        });
    });

    it('pressing Escape exits rename mode without saving', async () => {
        const user = userEvent.setup();
        render(<SaveLoadButtons />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: 'My Reno' }));
        const input = screen.getByRole('textbox', { name: /project name/i });
        await user.clear(input);
        await user.type(input, 'Discarded');
        await user.keyboard('{Escape}');

        await waitFor(() => {
            expect(screen.queryByRole('textbox', { name: /project name/i })).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'My Reno' })).toBeInTheDocument();
        });
    });

    it('blurring the rename input commits the new name', async () => {
        const user = userEvent.setup();
        render(<SaveLoadButtons />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: 'My Reno' }));
        const input = screen.getByRole('textbox', { name: /project name/i });
        await user.clear(input);
        await user.type(input, 'Blurred Name');
        await user.tab(); // blur

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Blurred Name' })).toBeInTheDocument();
        });
    });

    it('does not rename when the input is cleared to empty and Enter is pressed', async () => {
        const user = userEvent.setup();
        render(<SaveLoadButtons />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: 'My Reno' }));
        const input = screen.getByRole('textbox', { name: /project name/i });
        await user.clear(input);
        await user.keyboard('{Enter}');

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'My Reno' })).toBeInTheDocument();
        });
    });
});
