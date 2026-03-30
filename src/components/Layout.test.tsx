import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProvider } from '../contexts/AppContext';
import Layout from './Layout';

// Stub out URL.createObjectURL since SaveLoadButtons lives inside Layout
vi.stubGlobal('alert', vi.fn());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderLayout(initialPath = '/notes') {
    return render(
        <AppProvider>
            <MemoryRouter initialEntries={[initialPath]}>
                <Routes>
                    <Route
                        path="/"
                        element={<Layout />}
                    >
                        <Route
                            path="notes"
                            element={<div>Notes content</div>}
                        />
                        <Route
                            path="tasks"
                            element={<div>Tasks content</div>}
                        />
                        <Route
                            path="finance"
                            element={<div>Finance content</div>}
                        />
                        <Route
                            path="calendar"
                            element={<div>Calendar content</div>}
                        />
                    </Route>
                </Routes>
            </MemoryRouter>
        </AppProvider>
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Layout', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubGlobal('alert', vi.fn());
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    });

    afterEach(() => {
        localStorage.clear();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    // ── Navigation links ──────────────────────────────────────────────────

    it('renders all 4 navigation links', () => {
        renderLayout();
        expect(screen.getByRole('link', { name: /notes/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /tasks/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /finance/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /calendar/i })).toBeInTheDocument();
    });

    it('clicking Notes link shows Notes content', async () => {
        const user = userEvent.setup();
        renderLayout('/tasks');

        await user.click(screen.getByRole('link', { name: /notes/i }));

        await waitFor(() => {
            expect(screen.getByText('Notes content')).toBeInTheDocument();
        });
    });

    it('clicking Tasks link shows Tasks content', async () => {
        const user = userEvent.setup();
        renderLayout('/notes');

        await user.click(screen.getByRole('link', { name: /tasks/i }));

        await waitFor(() => {
            expect(screen.getByText('Tasks content')).toBeInTheDocument();
        });
    });

    it('clicking Finance link shows Finance content', async () => {
        const user = userEvent.setup();
        renderLayout('/notes');

        await user.click(screen.getByRole('link', { name: /finance/i }));

        await waitFor(() => {
            expect(screen.getByText('Finance content')).toBeInTheDocument();
        });
    });

    it('clicking Calendar link shows Calendar content', async () => {
        const user = userEvent.setup();
        renderLayout('/notes');

        await user.click(screen.getByRole('link', { name: /calendar/i }));

        await waitFor(() => {
            expect(screen.getByText('Calendar content')).toBeInTheDocument();
        });
    });

    // ── Active NavLink ────────────────────────────────────────────────────

    it('applies active class to the current route NavLink', () => {
        renderLayout('/notes');
        const notesLink = screen.getByRole('link', { name: /notes/i });
        expect(notesLink.className).toContain('bg-gray-700');
    });

    it('does not apply active class to non-current route NavLink', () => {
        renderLayout('/notes');
        const tasksLink = screen.getByRole('link', { name: /tasks/i });
        expect(tasksLink.className).not.toContain('border-l-4');
    });

    // ── Mobile sidebar ────────────────────────────────────────────────────

    it('renders the mobile hamburger button', () => {
        renderLayout();
        expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
    });

    it('opens the sidebar when hamburger is clicked', async () => {
        const user = userEvent.setup();
        renderLayout();

        await user.click(screen.getByRole('button', { name: /open menu/i }));

        // The Close button should now be visible
        expect(screen.getByRole('button', { name: /close menu/i })).toBeInTheDocument();
    });

    it('closes the sidebar when Close button is clicked', async () => {
        const user = userEvent.setup();
        const { container } = renderLayout();

        await user.click(screen.getByRole('button', { name: /open menu/i }));

        // Sidebar should now be open (translateX-0 not translate-x-full)
        const aside = container.querySelector('aside');
        expect(aside?.className).not.toContain('-translate-x-full');

        await user.click(screen.getByRole('button', { name: /close menu/i }));

        // Sidebar should have -translate-x-full class again (closed)
        await waitFor(() => {
            expect(container.querySelector('aside')?.className).toContain('-translate-x-full');
        });
    });

    it('closes the sidebar when backdrop is clicked', async () => {
        const user = userEvent.setup();
        const { container } = renderLayout();

        await user.click(screen.getByRole('button', { name: /open menu/i }));

        const aside = container.querySelector('aside');
        expect(aside?.className).not.toContain('-translate-x-full');

        // The backdrop div appears when sidebar is open (fixed inset-0 bg-black/50 z-30)
        const backdrop = container.querySelector('.fixed.inset-0');
        if (backdrop) {
            await user.click(backdrop);
        }

        await waitFor(() => {
            expect(container.querySelector('aside')?.className).toContain('-translate-x-full');
        });
    });

    // ── SaveLoadButtons ───────────────────────────────────────────────────

    it('renders SaveLoadButtons (💾 Save and 📂 Load) within Layout', () => {
        renderLayout();
        expect(screen.getByRole('button', { name: /💾 save/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /📂 load/i })).toBeInTheDocument();
    });

    // ── Outlet content ────────────────────────────────────────────────────

    it('renders outlet content for /notes', () => {
        renderLayout('/notes');
        expect(screen.getByText('Notes content')).toBeInTheDocument();
    });

    it('renders outlet content for /tasks', () => {
        renderLayout('/tasks');
        expect(screen.getByText('Tasks content')).toBeInTheDocument();
    });
});
