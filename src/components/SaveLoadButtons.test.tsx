import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProvider } from '../contexts/AppContext';
import type { AppData } from '../types';

import SaveLoadButtons from './SaveLoadButtons';


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

    it('clicking Save does not throw', async () => {
        const user = userEvent.setup();
        render(<SaveLoadButtons />, { wrapper: Wrapper });

        await expect(
            user.click(screen.getByRole('button', { name: /💾 save/i }))
        ).resolves.not.toThrow();

        // Drain any pending timers/promises
        await new Promise(r => setTimeout(r, 50));
    });

    it('clicking Save either calls URL.createObjectURL (success) or calls alert (failure)', async () => {
        const user = userEvent.setup();
        render(<SaveLoadButtons />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /💾 save/i }));

        // Wait a moment for async operations to complete
        await new Promise(r => setTimeout(r, 50));

        const savedSuccessfully = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls.length > 0;
        const alerted = (window.alert as ReturnType<typeof vi.fn>).mock.calls.length > 0;
        expect(savedSuccessfully || alerted).toBe(true);
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
            const stored = JSON.parse(localStorage.getItem('renovation-data') ?? '{}') as AppData;
            expect(stored.budget).toBe(77777);
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

    // ── Deployment info ───────────────────────────────────────────────────

    describe('deployment info', () => {
        afterEach(() => {
            vi.unstubAllEnvs();
        });

        it('is not rendered when both env vars are absent', () => {
            render(<SaveLoadButtons />, { wrapper: Wrapper });
            expect(screen.queryByText(/·/)).not.toBeInTheDocument();
        });

        it('shows truncated SHA with full SHA as title when only VITE_VERCEL_GIT_COMMIT_SHA is set', () => {
            const sha = 'abc1234567890abcdef';
            vi.stubEnv('VITE_VERCEL_GIT_COMMIT_SHA', sha);
            render(<SaveLoadButtons />, { wrapper: Wrapper });

            const shaSpan = screen.getByTitle(sha);
            expect(shaSpan).toBeInTheDocument();
            expect(shaSpan).toHaveTextContent('abc1234');
            expect(screen.queryByText(/·/)).not.toBeInTheDocument();
        });

        it('shows deployment ID without separator when only VITE_VERCEL_DEPLOYMENT_ID is set', () => {
            vi.stubEnv('VITE_VERCEL_DEPLOYMENT_ID', 'dpl_test123');
            render(<SaveLoadButtons />, { wrapper: Wrapper });

            expect(screen.getByText('dpl_test123')).toBeInTheDocument();
            expect(screen.queryByText(/·/)).not.toBeInTheDocument();
        });

        it('shows both SHA and deployment ID with separator when both env vars are set', () => {
            const sha = 'abc1234567890abcdef';
            vi.stubEnv('VITE_VERCEL_GIT_COMMIT_SHA', sha);
            vi.stubEnv('VITE_VERCEL_DEPLOYMENT_ID', 'dpl_test123');
            render(<SaveLoadButtons />, { wrapper: Wrapper });

            expect(screen.getByTitle(sha)).toHaveTextContent('abc1234');
            expect(screen.getByText('dpl_test123')).toBeInTheDocument();
            expect(screen.getByText(/·/)).toBeInTheDocument();
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

            // No link for sha
            expect(screen.queryByRole('link')).not.toBeInTheDocument();
            expect(screen.getByTitle(sha)).toHaveTextContent('abc1234');
        });

        it('shows changelog link pointing to GitHub releases when provider is github', () => {
            vi.stubEnv('VITE_VERCEL_GIT_PROVIDER', 'github');
            vi.stubEnv('VITE_VERCEL_GIT_REPO_OWNER', 'owner');
            vi.stubEnv('VITE_VERCEL_GIT_REPO_SLUG', 'repo');
            render(<SaveLoadButtons />, { wrapper: Wrapper });

            const link = screen.getByRole('link', { name: /changelog/i });
            expect(link).toHaveAttribute('href', 'https://github.com/owner/repo/releases');
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveAttribute('rel', 'noreferrer');
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

        it('shows changelog link with separator after deployment info when sha is also set', () => {
            const sha = 'abc1234567890abcdef';
            vi.stubEnv('VITE_VERCEL_GIT_COMMIT_SHA', sha);
            vi.stubEnv('VITE_VERCEL_GIT_PROVIDER', 'github');
            vi.stubEnv('VITE_VERCEL_GIT_REPO_OWNER', 'owner');
            vi.stubEnv('VITE_VERCEL_GIT_REPO_SLUG', 'repo');
            render(<SaveLoadButtons />, { wrapper: Wrapper });

            expect(screen.getByText(/·/)).toBeInTheDocument();
            expect(screen.getByRole('link', { name: /changelog/i })).toBeInTheDocument();
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
