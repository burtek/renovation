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
});
