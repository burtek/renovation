import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AppProvider } from '../../contexts/AppContext';
import { ACTIVE_PROJECT_KEY, STORAGE_KEY_PREFIX } from '../../storage/types';
import type { AppData, CalendarEvent, CalendarEventType } from '../../types';

import CalendarPage from '.';


vi.mock('react-big-calendar', () => ({
    Calendar: ({ onSelectSlot, onSelectEvent, events, components, eventPropGetter }: {
        onSelectSlot?: (slot: { start: Date; end: Date; slots: Date[]; action: string }) => void;
        onSelectEvent?: (event: { title: string; start: Date; end: Date; allDay: boolean; resource: CalendarEvent }) => void;
        events?: Array<{ title: string; start: Date; end: Date; allDay: boolean; resource: CalendarEvent }>;
        components?: { event?: ComponentType<{ event: { title: string; start: Date; end: Date; allDay: boolean; resource: CalendarEvent } }> };
        eventPropGetter?: (event: { title: string; start: Date; end: Date; allDay: boolean; resource: CalendarEvent }) =>
        { style?: Record<string, string> };
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
            {events?.map(e => {
                const EventComp = components?.event;
                const eventProps = eventPropGetter?.(e);
                return (
                    <button
                        type="button"
                        key={e.resource.id}
                        style={eventProps?.style}
                        onClick={() => onSelectEvent?.(e)}
                    >
                        {EventComp ? <EventComp event={e} /> : e.title}
                    </button>
                );
            })}
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

const TEST_PROJECT_ID = 'test-project-id';

function preloadState(state: Partial<AppData>) {
    localStorage.setItem(
        `${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`,
        JSON.stringify({ meta: { name: 'Test', lastModified: '2024-01-01T00:00:00.000Z' }, data: { notes: [], tasks: [], expenses: [], calendarEvents: [], budget: 0, ...state } })
    );
    localStorage.setItem(ACTIVE_PROJECT_KEY, TEST_PROJECT_ID);
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
        // Set up a default project so Calendar page renders without showing ProjectModal
        localStorage.setItem(
            `${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`,
            JSON.stringify({ meta: { name: 'Test', lastModified: '2024-01-01T00:00:00.000Z' }, data: { notes: [], tasks: [], expenses: [], calendarEvents: [], budget: 0 } })
        );
        localStorage.setItem(ACTIVE_PROJECT_KEY, TEST_PROJECT_ID);
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

        expect(screen.getByRole('combobox', { name: /event type/i })).toHaveValue('event');
    });

    it('selecting a different event type updates the dropdown', async () => {
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        await user.click(screen.getByTestId('select-slot'));

        await user.selectOptions(screen.getByRole('combobox', { name: /event type/i }), 'contractor work');

        expect(screen.getByRole('combobox', { name: /event type/i })).toHaveValue('contractor work');
    });

    it('opens Edit Event modal with pre-filled event type when clicking an existing event', async () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', eventType: 'own work' })] });
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: 'Test Event' }));

        expect(screen.getByRole('combobox', { name: /event type/i })).toHaveValue('own work');
    });

    // ── Drag and drop ─────────────────────────────────────────────────────

    it('moves a single-day event to a new date when dropped', async () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'Draggable Event', date: '2024-03-01' })] });
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        // Drop button simulates onEventDrop with start=2024-04-01, end=2024-04-02 (exclusive)
        await user.click(screen.getByTestId('drop-ev1'));

        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem(`${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`) ?? '{}') as { data: AppData };
            const updated = stored.data.calendarEvents.find(e => e.id === 'ev1');
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
            const stored = JSON.parse(localStorage.getItem(`${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`) ?? '{}') as { data: AppData };
            const updated = stored.data.calendarEvents.find(e => e.id === 'ev2');
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
            const stored = JSON.parse(localStorage.getItem(`${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`) ?? '{}') as { data: AppData };
            const updated = stored.data.calendarEvents.find(e => e.id === 'ev3');
            expect(updated?.date).toBe('2024-04-01');
            expect(updated?.contractor).toBe('Bob');
            expect(updated?.title).toBe('Colored Event');
        });
    });

    // ── Contractor display in calendar ────────────────────────────────────

    it('shows contractor name in calendar event when contractor is set', async () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'Plumbing', contractor: 'Bob' })] });
        render(<CalendarPage />, { wrapper: Wrapper });

        expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('does not show contractor text when contractor is not set', async () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'My Event' })] });
        render(<CalendarPage />, { wrapper: Wrapper });

        // Only the title should be visible, no extra contractor element
        expect(screen.queryAllByText('My Event')).toHaveLength(1);
    });

    // ── Contractor suggestions datalist ───────────────────────────────────

    it('shows contractor suggestions from existing events in the datalist', async () => {
        preloadState({
            calendarEvents: [
                makeCalendarEvent({ id: 'ev1', contractor: 'Alice' }),
                makeCalendarEvent({ id: 'ev2', contractor: 'Bob' }),
                makeCalendarEvent({ id: 'ev3' }) // no contractor
            ]
        });
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        await user.click(screen.getByTestId('select-slot'));

        const datalist = document.getElementById('contractor-suggestions');
        expect(datalist).toBeInTheDocument();
        expect(datalist?.querySelector('option[value="Alice"]')).toBeInTheDocument();
        expect(datalist?.querySelector('option[value="Bob"]')).toBeInTheDocument();
    });

    it('deduplicates contractor suggestions in the datalist', async () => {
        preloadState({
            calendarEvents: [
                makeCalendarEvent({ id: 'ev1', contractor: 'Alice' }),
                makeCalendarEvent({ id: 'ev2', contractor: 'Alice' })
            ]
        });
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        await user.click(screen.getByTestId('select-slot'));

        const datalist = document.getElementById('contractor-suggestions');
        expect(datalist?.querySelectorAll('option[value="Alice"]')).toHaveLength(1);
    });

    // ── EventModal end date and notes fields ──────────────────────────────

    it('typing in the contractor field in the modal updates the form', async () => {
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        await user.click(screen.getByTestId('select-slot'));

        await user.type(screen.getByPlaceholderText(/contractor/i), 'Bob');

        expect(screen.getByPlaceholderText(/contractor/i)).toHaveValue('Bob');
    });

    it('changing the end date input in the modal updates the form', async () => {
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        await user.click(screen.getByTestId('select-slot'));

        // Both date inputs are type="date"; the second one is the end-date input
        const dateInputs = document.querySelectorAll('input[type="date"]');
        const endDateInput = dateInputs[1] as HTMLInputElement;

        fireEvent.change(endDateInput, { target: { value: '2024-03-20' } });

        expect(endDateInput.value).toBe('2024-03-20');
    });

    it('typing in the notes textarea in the modal updates the form', async () => {
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        await user.click(screen.getByTestId('select-slot'));

        await user.type(screen.getByPlaceholderText(/notes/i), 'Bring the plans');

        expect(screen.getByPlaceholderText(/notes/i)).toHaveValue('Bring the plans');
    });

    it('an event saved with notes persists the notes value', async () => {
        const user = userEvent.setup();
        render(<CalendarPage />, { wrapper: Wrapper });

        await user.click(screen.getByTestId('select-slot'));

        await user.type(screen.getByPlaceholderText(/title \*/i), 'Site Visit');
        await user.type(screen.getByPlaceholderText(/notes/i), 'Bring helmet');
        await user.click(screen.getByRole('button', { name: /save/i }));

        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem(`${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`) ?? '{}') as { data: AppData };
            const saved = stored.data.calendarEvents.find(e => e.title === 'Site Visit');
            expect(saved?.notes).toBe('Bring helmet');
        });
    });
});
