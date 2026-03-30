import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProvider } from '../contexts/AppContext';
import type { AppData, CalendarEvent, CalendarEventType } from '../types';

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
vi.mock('react-big-calendar/lib/addons/dragAndDrop/styles.css', () => ({}));
vi.mock('react-big-calendar/lib/addons/dragAndDrop', () => ({
    default: (Cal: ComponentType<{
        events?: Array<{ title: string; start: Date; end: Date; allDay: boolean; resource: CalendarEvent }>;
        [key: string]: unknown;
    }>) =>
        function DnDCalendarMock({ onEventDrop, onEventResize, ...rest }: {
            onEventDrop?: (args: {
                event: { title: string; start: Date; end: Date; allDay: boolean; resource: CalendarEvent };
                start: Date;
                end: Date;
                isAllDay: boolean;
            }) => void;
            onEventResize?: (args: {
                event: { title: string; start: Date; end: Date; allDay: boolean; resource: CalendarEvent };
                start: Date;
                end: Date;
                isAllDay: boolean;
            }) => void;
            events?: Array<{ title: string; start: Date; end: Date; allDay: boolean; resource: CalendarEvent }>;
            [key: string]: unknown;
        }) {
            return (
                <>
                    <Cal {...rest} />
                    {rest.events?.map(e => (
                        <span key={e.resource.id}>
                            <button
                                type="button"
                                data-testid={`drop-${e.resource.id}`}
                                onClick={() => onEventDrop?.({
                                    event: e,
                                    start: new Date('2024-04-01T00:00:00'),
                                    end: new Date('2024-04-02T00:00:00'),
                                    isAllDay: true
                                })}
                            >
                                Drop {e.title}
                            </button>
                            <button
                                type="button"
                                data-testid={`resize-${e.resource.id}`}
                                onClick={() => onEventResize?.({
                                    event: e,
                                    start: new Date('2024-04-01T00:00:00'),
                                    end: new Date('2024-04-04T00:00:00'),
                                    isAllDay: true
                                })}
                            >
                                Resize {e.title}
                            </button>
                        </span>
                    ))}
                </>
            );
        }
}));

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
        eventType: 'event' as CalendarEventType,
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

    // ── Event type ────────────────────────────────────────────────────────

    it('event type dropdown defaults to "event"', async () => {
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        await user.click(screen.getByTestId('select-slot'));

        expect(screen.getByRole('combobox')).toHaveValue('event');
    });

    it('selecting a different event type updates the dropdown', async () => {
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        await user.click(screen.getByTestId('select-slot'));

        await user.selectOptions(screen.getByRole('combobox'), 'contractor work');

        expect(screen.getByRole('combobox')).toHaveValue('contractor work');
    });

    it('opens Edit Event modal with pre-filled event type when clicking an existing event', async () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', eventType: 'own work' })] });
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: 'Test Event' }));

        expect(screen.getByRole('combobox')).toHaveValue('own work');
    });

    // ── Drag and drop ─────────────────────────────────────────────────────

    it('moves a single-day event to a new date when dropped', async () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'Draggable Event', date: '2024-03-01' })] });
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        // Drop button simulates onEventDrop with start=2024-04-01, end=2024-04-02 (exclusive)
        await user.click(screen.getByTestId('drop-ev1'));

        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem('renovation-data') ?? '{}') as AppData;
            const updated = stored.calendarEvents.find(e => e.id === 'ev1');
            expect(updated?.date).toBe('2024-04-01');
            expect(updated?.endDate).toBeUndefined();
        });
    });

    it('moves a multi-day event and preserves its span when dropped', async () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev2', title: 'Multi-day Event', date: '2024-03-01', endDate: '2024-03-03' })] });
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        // Resize button simulates onEventResize with start=2024-04-01, end=2024-04-04 (exclusive → 2024-04-03 inclusive)
        await user.click(screen.getByTestId('resize-ev2'));

        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem('renovation-data') ?? '{}') as AppData;
            const updated = stored.calendarEvents.find(e => e.id === 'ev2');
            expect(updated?.date).toBe('2024-04-01');
            expect(updated?.endDate).toBe('2024-04-03');
        });
    });

    it('preserves other event properties (title, contractor, etc.) after drag', async () => {
        preloadState({
            calendarEvents: [
                makeCalendarEvent({
                    id: 'ev3',
                    title: 'Colored Event',
                    date: '2024-03-01',
                    contractor: 'Bob'
                })
            ]
        });
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        await user.click(screen.getByTestId('drop-ev3'));

        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem('renovation-data') ?? '{}') as AppData;
            const updated = stored.calendarEvents.find(e => e.id === 'ev3');
            expect(updated?.date).toBe('2024-04-01');
            expect(updated?.contractor).toBe('Bob');
            expect(updated?.title).toBe('Colored Event');
        });
    });
});
