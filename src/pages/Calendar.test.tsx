import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProvider } from '../contexts/AppContext';
import type { AppData, CalendarEvent } from '../types';

import CalendarPage from './Calendar';


vi.mock('react-big-calendar', () => ({
    Calendar: ({ onSelectSlot, onSelectEvent, events }: {
        onSelectSlot?: (slot: { start: Date; end: Date; slots: Date[]; action: string }) => void;
        onSelectEvent?: (event: { title: string; start: Date; end: Date; allDay: boolean; resource: CalendarEvent }) => void;
        events?: Array<{ title: string; start: Date; end: Date; allDay: boolean; resource: CalendarEvent }>;
    }) => (
        <div data-testid="rbc-calendar">
            <button
                type="button"
                data-testid="select-slot"
                onClick={() => onSelectSlot?.({
                    start: new Date('2024-03-15'),
                    end: new Date('2024-03-16'),
                    slots: [],
                    action: 'click'
                })}
            >
                Select slot
            </button>
            {events?.map(e => (
                <button
                    type="button"
                    key={e.resource.id}
                    onClick={() => onSelectEvent?.(e)}
                >
                    {e.title}
                </button>
            ))}
        </div>
    ),
    dateFnsLocalizer: () => ({})
}));
vi.mock('react-big-calendar/lib/css/react-big-calendar.css', () => ({}));

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

function preloadState(state: Partial<AppData>) {
    localStorage.setItem(
        'renovation-data',
        JSON.stringify({ notes: [], tasks: [], expenses: [], calendarEvents: [], budget: 0, ...state })
    );
}

function makeCalendarEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
    return {
        id: 'ev1',
        title: 'Test Event',
        date: '2024-03-01',
        workType: 'Work',
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Calendar page', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubGlobal('confirm', vi.fn(() => true));
    });

    afterEach(() => {
        localStorage.clear();
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    // ── Basic rendering ───────────────────────────────────────────────────

    it('renders Calendar heading', () => {
        render(<CalendarPage />, { wrapper: Wrapper });
        expect(screen.getByRole('heading', { name: /calendar/i })).toBeInTheDocument();
    });

    it('renders the rbc-calendar mock', () => {
        render(<CalendarPage />, { wrapper: Wrapper });
        expect(screen.getByTestId('rbc-calendar')).toBeInTheDocument();
    });

    // ── Slot selection ────────────────────────────────────────────────────

    it('opens New Event modal when a slot is selected', async () => {
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        await user.click(screen.getByTestId('select-slot'));

        expect(screen.getByRole('heading', { name: /new event/i })).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/title \*/i)).toBeInTheDocument();
    });

    // ── Add event ─────────────────────────────────────────────────────────

    it('adds an event when title and start date are filled', async () => {
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        await user.click(screen.getByTestId('select-slot'));

        await user.type(screen.getByPlaceholderText(/title \*/i), 'My New Event');
        await user.click(screen.getByRole('button', { name: /save/i }));

        await waitFor(() => {
            // The mock Calendar renders the event as a button
            expect(screen.getByRole('button', { name: 'My New Event' })).toBeInTheDocument();
        });
    });

    it('does not add an event when title is empty', async () => {
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        await user.click(screen.getByTestId('select-slot'));
        // Don't type anything
        await user.click(screen.getByRole('button', { name: /save/i }));

        // Modal should still be open
        expect(screen.getByRole('heading', { name: /new event/i })).toBeInTheDocument();
    });

    it('does not add an event when start date is missing', async () => {
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        await user.click(screen.getByTestId('select-slot'));

        await user.type(screen.getByPlaceholderText(/title \*/i), 'No Date Event');

        // Clear the start date that was pre-filled by the slot selection
        const startDateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
        if (startDateInput) {
            fireEvent.change(startDateInput, { target: { value: '' } });
        }

        await user.click(screen.getByRole('button', { name: /save/i }));

        // Modal should still be open (save rejected due to missing start date)
        expect(screen.getByRole('heading', { name: /new event/i })).toBeInTheDocument();
    });

    it('Cancel closes the modal', async () => {
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        await user.click(screen.getByTestId('select-slot'));
        expect(screen.getByRole('heading', { name: /new event/i })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /cancel/i }));
        expect(screen.queryByRole('heading', { name: /new event/i })).not.toBeInTheDocument();
    });

    // ── Event selection / Edit ────────────────────────────────────────────

    it('opens Edit Event modal with pre-filled title when clicking an existing event', async () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'Existing Event' })] });
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: 'Existing Event' }));

        expect(screen.getByRole('heading', { name: /edit event/i })).toBeInTheDocument();
        expect(screen.getByDisplayValue('Existing Event')).toBeInTheDocument();
    });

    it('updates event title after editing', async () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'Old Event' })] });
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: 'Old Event' }));

        const titleInput = screen.getByDisplayValue('Old Event');
        await user.clear(titleInput);
        await user.type(titleInput, 'Updated Event');

        await user.click(screen.getByRole('button', { name: /save/i }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Updated Event' })).toBeInTheDocument();
        });
    });

    // ── Delete event ──────────────────────────────────────────────────────

    it('deletes an event when Delete is clicked and confirmed', async () => {
        vi.stubGlobal('confirm', vi.fn(() => true));
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'Delete Event' })] });
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: 'Delete Event' }));
        await user.click(screen.getByRole('button', { name: /^delete$/i }));

        await waitFor(() => {
            expect(screen.queryByRole('button', { name: 'Delete Event' })).not.toBeInTheDocument();
        });
    });

    it('keeps an event when Delete is not confirmed', async () => {
        vi.stubGlobal('confirm', vi.fn(() => false));
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'Keep Event' })] });
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: 'Keep Event' }));
        await user.click(screen.getByRole('button', { name: /^delete$/i }));

        expect(screen.getByRole('button', { name: 'Keep Event' })).toBeInTheDocument();
    });

    // ── Color picker ──────────────────────────────────────────────────────

    it('clicking a color button selects that color (button gets active class)', async () => {
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        await user.click(screen.getByTestId('select-slot'));

        // Click the "Blue" color button
        const blueBtn = screen.getByTitle('Blue');
        await user.click(blueBtn);

        expect(blueBtn.className).toContain('border-gray-800');
    });

    it('clicking the default color button clears the selection', async () => {
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        await user.click(screen.getByTestId('select-slot'));

        // Select a color first
        await user.click(screen.getByTitle('Blue'));

        // Then click default
        const defaultBtn = screen.getByTitle('Default');
        await user.click(defaultBtn);

        expect(defaultBtn.className).toContain('border-gray-800');
    });
});
