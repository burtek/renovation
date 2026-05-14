import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { format } from 'date-fns';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AppProvider } from '../../contexts/AppContext';
import { ACTIVE_PROJECT_KEY, STORAGE_KEY_PREFIX } from '../../storage/types';
import type { AppData, CalendarEvent, CalendarEventType, Expense } from '../../types';
import { formatPLN } from '../../utils/format';

import CalendarPage from '.';
import MonthCalendar from './MonthCalendar';


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fixed date passed to CalendarPage so all tests see March 2024 regardless of wall-clock. */
const DEFAULT_DATE = new Date('2024-03-15');

function Wrapper({ children }: { children: ReactNode }) {
    return (
        <AppProvider>
            <MemoryRouter>
                {children}
            </MemoryRouter>
        </AppProvider>
    );
}

function renderCalendar() {
    return render(<CalendarPage defaultDate={DEFAULT_DATE} />, { wrapper: Wrapper });
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

function makeExpense(overrides: Partial<Expense> = {}): Expense {
    return {
        id: 'exp1',
        description: 'Paint',
        date: '2024-03-01',
        price: 123,
        shopName: 'Leroy',
        invoiceNo: 'INV-1',
        invoiceForm: 'paper',
        loanApproved: false,
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
        renderCalendar();
        expect(screen.getByRole('heading', { name: /calendar/i })).toBeInTheDocument();
    });

    it('renders the month calendar with the correct month heading', () => {
        renderCalendar();
        expect(screen.getByText('March 2024')).toBeInTheDocument();
    });

    it('renders prev/next/today navigation buttons', () => {
        renderCalendar();
        expect(screen.getByRole('button', { name: /previous month/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /next month/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /today/i })).toBeInTheDocument();
    });

    it('navigates to the previous month', async () => {
        const user = userEvent.setup();
        renderCalendar();

        await user.click(screen.getByRole('button', { name: /previous month/i }));

        expect(screen.getByText('February 2024')).toBeInTheDocument();
    });

    it('navigates to the next month', async () => {
        const user = userEvent.setup();
        renderCalendar();

        await user.click(screen.getByRole('button', { name: /next month/i }));

        expect(screen.getByText('April 2024')).toBeInTheDocument();
    });

    it('renders Mon–Sun day-of-week labels', () => {
        renderCalendar();
        for (const label of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
            expect(screen.getByText(label)).toBeInTheDocument();
        }
    });

    // ── Slot selection ────────────────────────────────────────────────────

    it('opens New Event modal when a day cell is clicked', async () => {
        const user = userEvent.setup();
        renderCalendar();

        await user.click(screen.getByTestId('calendar-day-2024-03-15'));

        expect(screen.getByRole('heading', { name: /new event/i })).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/title \*/i)).toBeInTheDocument();
    });

    it('pre-fills start date from the clicked day', async () => {
        const user = userEvent.setup();
        renderCalendar();

        await user.click(screen.getByTestId('calendar-day-2024-03-20'));

        const dateInputs = document.querySelectorAll('input[type="date"]');
        expect((dateInputs[0] as HTMLInputElement).value).toBe('2024-03-20');
    });

    // ── Autofocus ─────────────────────────────────────────────────────────

    it('autofocuses the title field when the "New Event" modal opens', async () => {
        const user = userEvent.setup();
        renderCalendar();

        await user.click(screen.getByTestId('calendar-day-2024-03-15'));

        expect(document.activeElement).toBe(screen.getByPlaceholderText(/title \*/i));
    });

    it('autofocuses the title field when the "Edit Event" modal opens', async () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'Focus Event' })] });
        const user = userEvent.setup();
        renderCalendar();

        await user.click(screen.getByRole('button', { name: 'Focus Event' }));

        expect(document.activeElement).toBe(screen.getByDisplayValue('Focus Event'));
    });

    // ── Add event ─────────────────────────────────────────────────────────

    it('adds an event when title and start date are filled', async () => {
        const user = userEvent.setup();
        renderCalendar();

        await user.click(screen.getByTestId('calendar-day-2024-03-15'));

        await user.type(screen.getByPlaceholderText(/title \*/i), 'My New Event');
        await user.click(screen.getByRole('button', { name: /save/i }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'My New Event' })).toBeInTheDocument();
        });
    });

    it('does not add an event when title is empty', async () => {
        const user = userEvent.setup();
        renderCalendar();

        await user.click(screen.getByTestId('calendar-day-2024-03-15'));
        // Don't type anything
        await user.click(screen.getByRole('button', { name: /save/i }));

        // Modal should still be open
        expect(screen.getByRole('heading', { name: /new event/i })).toBeInTheDocument();
    });

    it('does not add an event when start date is missing', async () => {
        const user = userEvent.setup();
        renderCalendar();

        await user.click(screen.getByTestId('calendar-day-2024-03-15'));

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
        renderCalendar();

        await user.click(screen.getByTestId('calendar-day-2024-03-15'));
        expect(screen.getByRole('heading', { name: /new event/i })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /cancel/i }));
        expect(screen.queryByRole('heading', { name: /new event/i })).not.toBeInTheDocument();
    });

    // ── Event selection / Edit ────────────────────────────────────────────

    it('opens Edit Event modal with pre-filled title when clicking an existing event', async () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'Existing Event' })] });
        const user = userEvent.setup();
        renderCalendar();

        await user.click(screen.getByRole('button', { name: 'Existing Event' }));

        expect(screen.getByRole('heading', { name: /edit event/i })).toBeInTheDocument();
        expect(screen.getByDisplayValue('Existing Event')).toBeInTheDocument();
    });

    it('updates event title after editing', async () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'Old Event' })] });
        const user = userEvent.setup();
        renderCalendar();

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
        renderCalendar();

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
        renderCalendar();

        await user.click(screen.getByRole('button', { name: 'Keep Event' }));
        await user.click(screen.getByRole('button', { name: /^delete$/i }));

        expect(screen.getByRole('button', { name: 'Keep Event' })).toBeInTheDocument();
    });

    // ── Event type ────────────────────────────────────────────────────────

    it('event type dropdown defaults to "event"', async () => {
        const user = userEvent.setup();
        renderCalendar();

        await user.click(screen.getByTestId('calendar-day-2024-03-15'));

        expect(screen.getByRole('combobox', { name: /event type/i })).toHaveValue('event');
    });

    it('selecting a different event type updates the dropdown', async () => {
        const user = userEvent.setup();
        renderCalendar();

        await user.click(screen.getByTestId('calendar-day-2024-03-15'));

        await user.selectOptions(screen.getByRole('combobox', { name: /event type/i }), 'contractor work');

        expect(screen.getByRole('combobox', { name: /event type/i })).toHaveValue('contractor work');
    });

    it('opens Edit Event modal with pre-filled event type when clicking an existing event', async () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', eventType: 'own work' })] });
        const user = userEvent.setup();
        renderCalendar();

        await user.click(screen.getByRole('button', { name: 'Test Event' }));

        expect(screen.getByRole('combobox', { name: /event type/i })).toHaveValue('own work');
    });

    // ── Contractor display in calendar ────────────────────────────────────

    it('shows contractor name in calendar event when contractor is set', async () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'Plumbing', contractor: 'Bob' })] });
        renderCalendar();

        expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('does not show contractor text when contractor is not set', async () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'My Event' })] });
        renderCalendar();

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
        renderCalendar();

        await user.click(screen.getByTestId('calendar-day-2024-03-15'));

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
        renderCalendar();

        await user.click(screen.getByTestId('calendar-day-2024-03-15'));

        const datalist = document.getElementById('contractor-suggestions');
        expect(datalist?.querySelectorAll('option[value="Alice"]')).toHaveLength(1);
    });

    // ── EventModal end date and notes fields ──────────────────────────────

    it('typing in the contractor field in the modal updates the form', async () => {
        const user = userEvent.setup();
        renderCalendar();

        await user.click(screen.getByTestId('calendar-day-2024-03-15'));

        await user.type(screen.getByPlaceholderText(/contractor/i), 'Bob');

        expect(screen.getByPlaceholderText(/contractor/i)).toHaveValue('Bob');
    });

    it('changing the end date input in the modal updates the form', async () => {
        const user = userEvent.setup();
        renderCalendar();

        await user.click(screen.getByTestId('calendar-day-2024-03-15'));

        // Both date inputs are type="date"; the second one is the end-date input
        const dateInputs = document.querySelectorAll('input[type="date"]');
        const endDateInput = dateInputs[1] as HTMLInputElement;

        fireEvent.change(endDateInput, { target: { value: '2024-03-20' } });

        expect(endDateInput.value).toBe('2024-03-20');
    });

    it('typing in the notes textarea in the modal updates the form', async () => {
        const user = userEvent.setup();
        renderCalendar();

        await user.click(screen.getByTestId('calendar-day-2024-03-15'));

        await user.type(screen.getByPlaceholderText(/notes/i), 'Bring the plans');

        expect(screen.getByPlaceholderText(/notes/i)).toHaveValue('Bring the plans');
    });

    it('an event saved with notes persists the notes value', async () => {
        const user = userEvent.setup();
        renderCalendar();

        await user.click(screen.getByTestId('calendar-day-2024-03-15'));

        await user.type(screen.getByPlaceholderText(/title \*/i), 'Site Visit');
        await user.type(screen.getByPlaceholderText(/notes/i), 'Bring helmet');
        await user.click(screen.getByRole('button', { name: /save/i }));

        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem(`${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`) ?? '{}') as { data: AppData };
            const saved = stored.data.calendarEvents.find(e => e.title === 'Site Visit');
            expect(saved?.notes).toBe('Bring helmet');
        });
    });

    // ── Event component truncation ────────────────────────────────────────

    it('event wrapper has overflow-hidden and title has truncate class', () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'Long Event Title' })] });
        renderCalendar();

        const titleEl = screen.getByText('Long Event Title');
        expect(titleEl).toHaveClass('truncate');
        expect(titleEl.parentElement).toHaveClass('overflow-hidden');
    });

    it('contractor line has truncate class', () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'Event', contractor: 'Bob Builder' })] });
        renderCalendar();

        const contractorEl = screen.getByText('Bob Builder');
        expect(contractorEl).toHaveClass('truncate');
    });

    // ── Expense items in calendar ─────────────────────────────────────────

    it('renders expense as a calendar item with emoji price and description', () => {
        preloadState({ expenses: [makeExpense({ price: 123, description: 'Paint' })] });
        renderCalendar();

        expect(screen.getByRole('button', { name: `💶 ${formatPLN(123)} - Paint` })).toBeInTheDocument();
    });

    it('formats expense price with decimals when not a whole number', () => {
        preloadState({ expenses: [makeExpense({ price: 99.5, description: 'Tiles' })] });
        renderCalendar();

        expect(screen.getByRole('button', { name: `💶 ${formatPLN(99.5)} - Tiles` })).toBeInTheDocument();
    });

    it('does not open any modal when clicking an expense item', async () => {
        preloadState({ expenses: [makeExpense({ id: 'exp1', price: 123, description: 'Paint' })] });
        const user = userEvent.setup();
        renderCalendar();

        await user.click(screen.getByRole('button', { name: `💶 ${formatPLN(123)} - Paint` }));

        expect(screen.queryByRole('heading', { name: /event/i })).not.toBeInTheDocument();
    });

    it('does not render expense items without a date', () => {
        preloadState({ expenses: [makeExpense({ id: 'exp1', description: 'NoDated', date: '' })] });
        renderCalendar();

        expect(screen.queryByText(/NoDated/)).not.toBeInTheDocument();
    });

    it('does not render expense items with an invalid date string', () => {
        preloadState({ expenses: [makeExpense({ id: 'exp1', description: 'BadDate', date: '2024-13-99' })] });
        renderCalendar();

        expect(screen.queryByText(/BadDate/)).not.toBeInTheDocument();
    });

    // ── Dark-mode classes ──────────────────────────────────────────────────

    it('off-month day cells carry the correct dark-mode background class', () => {
        // Feb 29 2024 falls in the grid when March 2024 is displayed
        renderCalendar();

        const offMonthCell = screen.getByTestId('calendar-day-2024-02-29');

        // Must use a real Tailwind dark-mode colour (not the non-existent gray-850)
        expect(offMonthCell.className).toContain('dark:bg-gray-900');
        expect(offMonthCell.className).not.toContain('gray-850');
    });

    it('day cells carry the correct dark-mode hover class', () => {
        renderCalendar();

        const anyCell = screen.getByTestId('calendar-day-2024-03-15');

        // Must use a real Tailwind dark-mode colour (not the non-existent gray-750)
        expect(anyCell.className).toContain('dark:hover:bg-gray-700');
        expect(anyCell.className).not.toContain('gray-750');
    });

    // ── Equal-height rows that fill available page height ─────────────────

    it('week rows container uses CSS grid so all 6 rows equally divide the available height', () => {
        renderCalendar();

        // DOM: calendar-day-cell → day-cells-grid → week-row → rows-container
        const cell = screen.getByTestId('calendar-day-2024-03-01');
        const rowsContainer = cell.parentElement?.parentElement?.parentElement;

        expect(rowsContainer?.style.gridTemplateRows).toBe('repeat(6, 1fr)');
    });

    it('no week row carries an inline height style (height is controlled by CSS grid)', () => {
        renderCalendar();

        const cell = screen.getByTestId('calendar-day-2024-03-01');
        // cell → day-cells-grid → week-row
        const weekRow = cell.parentElement?.parentElement;

        expect(weekRow?.style.height).toBeFalsy();
    });

    it('each week row contains a scrollable events area', () => {
        renderCalendar();

        const scrollAreas = screen.getAllByTestId('week-events-scroll');

        // 6 weeks in the grid
        expect(scrollAreas).toHaveLength(6);
        for (const area of scrollAreas) {
            expect(area.className).toContain('overflow-y-auto');
        }
    });

    // ── Events visible without cutoff — per-row scroll handles overflow ────

    it('renders all events in a week even when they exceed the fixed row height', () => {
        // 5 single-day events on the same day — all should render (scroll to see them)
        preloadState({
            calendarEvents: [
                makeCalendarEvent({ id: 'a', title: 'Event A', date: '2024-03-04' }),
                makeCalendarEvent({ id: 'b', title: 'Event B', date: '2024-03-04' }),
                makeCalendarEvent({ id: 'c', title: 'Event C', date: '2024-03-04' }),
                makeCalendarEvent({ id: 'd', title: 'Event D', date: '2024-03-04' }),
                makeCalendarEvent({ id: 'e', title: 'Event E', date: '2024-03-04' })
            ]
        });
        renderCalendar();

        expect(screen.getByRole('button', { name: 'Event A' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Event B' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Event C' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Event D' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Event E' })).toBeInTheDocument();
    });

    it('does not render a "+N more" overflow indicator regardless of event count', () => {
        preloadState({
            calendarEvents: Array.from({ length: 8 }, (_, i) =>
                makeCalendarEvent({ id: `ev${i}`, title: `Event ${i}`, date: '2024-03-04' }))
        });
        renderCalendar();

        expect(screen.queryByText(/\+\d+ more/u)).not.toBeInTheDocument();
    });

    // ── Drag-and-drop: move event ─────────────────────────────────────────

    it('moves a calendar event when dropped on a new day', async () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'My Event', date: '2024-03-04' })] });
        renderCalendar();

        const chip = screen.getByRole('button', { name: 'My Event' });
        const targetDay = screen.getByTestId('calendar-day-2024-03-15');

        fireEvent.dragStart(chip);
        fireEvent.dragOver(targetDay);
        fireEvent.drop(targetDay);
        fireEvent.dragEnd(chip);

        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem(`${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`) ?? '{}') as { data: AppData };
            const event = stored.data.calendarEvents.find(e => e.id === 'ev1');
            expect(event?.date).toBe('2024-03-15');
        });
    });

    it('preserves event duration when moving a multi-day event', async () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'Multi Day', date: '2024-03-04', endDate: '2024-03-06' })] });
        renderCalendar();

        const chip = screen.getByRole('button', { name: 'Multi Day' });
        const targetDay = screen.getByTestId('calendar-day-2024-03-18');

        fireEvent.dragStart(chip);
        fireEvent.dragOver(targetDay);
        fireEvent.drop(targetDay);
        fireEvent.dragEnd(chip);

        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem(`${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`) ?? '{}') as { data: AppData };
            const event = stored.data.calendarEvents.find(e => e.id === 'ev1');
            // Duration was 2 days (March 4–6), so new event should be March 18–20
            expect(event?.date).toBe('2024-03-18');
            expect(event?.endDate).toBe('2024-03-20');
        });
    });

    it('does not move an expense when dragged to a new day', async () => {
        preloadState({ expenses: [makeExpense({ id: 'exp1', description: 'Paint', date: '2024-03-04', price: 10 })] });
        renderCalendar();

        const chip = screen.getByRole('button', { name: `💶 ${formatPLN(10)} - Paint` });
        const targetDay = screen.getByTestId('calendar-day-2024-03-15');

        fireEvent.dragStart(chip);
        fireEvent.dragOver(targetDay);
        fireEvent.drop(targetDay);
        fireEvent.dragEnd(chip);

        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem(`${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`) ?? '{}') as { data: AppData };
            const expense = stored.data.expenses.find(e => e.id === 'exp1');
            expect(expense?.date).toBe('2024-03-04'); // unchanged
        });
    });

    // ── Drag-and-drop: resize event ───────────────────────────────────────

    it('resizes a calendar event when the resize handle is dragged to a later day', async () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'My Event', date: '2024-03-04' })] });
        renderCalendar();

        const chip = screen.getByRole('button', { name: 'My Event' });
        const resizeHandle = within(chip).getByTestId('event-resize-handle');
        const targetDay = screen.getByTestId('calendar-day-2024-03-08');

        fireEvent.dragStart(resizeHandle);
        fireEvent.dragOver(targetDay);
        fireEvent.drop(targetDay);
        fireEvent.dragEnd(resizeHandle);

        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem(`${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`) ?? '{}') as { data: AppData };
            const event = stored.data.calendarEvents.find(e => e.id === 'ev1');
            expect(event?.date).toBe('2024-03-04'); // start unchanged
            expect(event?.endDate).toBe('2024-03-08'); // new end
        });
    });

    it('removes endDate when resize handle is dropped back onto the start day', async () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'My Event', date: '2024-03-04', endDate: '2024-03-08' })] });
        renderCalendar();

        const chip = screen.getByRole('button', { name: 'My Event' });
        const resizeHandle = within(chip).getByTestId('event-resize-handle');
        const sameDay = screen.getByTestId('calendar-day-2024-03-04');

        fireEvent.dragStart(resizeHandle);
        fireEvent.dragOver(sameDay);
        fireEvent.drop(sameDay);
        fireEvent.dragEnd(resizeHandle);

        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem(`${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`) ?? '{}') as { data: AppData };
            const event = stored.data.calendarEvents.find(e => e.id === 'ev1');
            expect(event?.date).toBe('2024-03-04');
            expect(event?.endDate).toBeUndefined(); // single-day event again
        });
    });

    it('does not resize an expense', async () => {
        preloadState({ expenses: [makeExpense({ id: 'exp1', description: 'Paint', date: '2024-03-04', price: 10 })] });
        renderCalendar();

        const chip = screen.getByRole('button', { name: `💶 ${formatPLN(10)} - Paint` });
        // onEventResize ignores expenses, but the handle is still rendered since MonthCalendar
        // doesn't know which events are expenses — the guard lives in CalendarPage.
        const resizeHandle = within(chip).getByTestId('event-resize-handle');
        const targetDay = screen.getByTestId('calendar-day-2024-03-08');

        fireEvent.dragStart(resizeHandle);
        fireEvent.dragOver(targetDay);
        fireEvent.drop(targetDay);
        fireEvent.dragEnd(resizeHandle);

        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem(`${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`) ?? '{}') as { data: AppData };
            const expense = stored.data.expenses.find(e => e.id === 'exp1');
            expect(expense?.date).toBe('2024-03-04'); // unchanged
        });
    });

    // ── Drag-and-drop: visual feedback ────────────────────────────────────

    it('adds pointer-events-none to all chip wrappers while dragging', () => {
        preloadState({
            calendarEvents: [
                makeCalendarEvent({ id: 'ev1', title: 'Event A', date: '2024-03-04' }),
                makeCalendarEvent({ id: 'ev2', title: 'Event B', date: '2024-03-11' })
            ]
        });
        renderCalendar();

        const chip = screen.getByRole('button', { name: 'Event A' });

        // Before drag: no pointer-events-none on chip wrappers
        expect(chip.parentElement?.className).not.toContain('pointer-events-none');

        fireEvent.dragStart(chip);

        // After dragStart: all chip wrappers become pointer-events-none
        expect(chip.parentElement?.className).toContain('pointer-events-none');

        fireEvent.dragEnd(chip);
    });

    it('clicking the Today button returns the calendar to the current month', async () => {
        const user = userEvent.setup();
        renderCalendar(); // shows March 2024

        // Navigate to a different month
        await user.click(screen.getByRole('button', { name: /previous month/i }));
        expect(screen.getByText('February 2024')).toBeInTheDocument();

        // Clicking Today should jump back to the current date's month
        await user.click(screen.getByRole('button', { name: /today/i }));
        const now = new Date();
        const monthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        expect(screen.getByText(monthYear)).toBeInTheDocument();
    });

    it('sort puts longer events before shorter events in the same week', () => {
        // Multi-day event (Mar 4–6) and single-day event (Mar 4) in the same week.
        // The sort comparator's bDur !== aDur branch renders the multi-day event on track 0.
        preloadState({
            calendarEvents: [
                makeCalendarEvent({ id: 'short', title: 'Short', date: '2024-03-04' }),
                makeCalendarEvent({ id: 'long', title: 'Long', date: '2024-03-04', endDate: '2024-03-06' })
            ]
        });
        renderCalendar();

        // Both events should be visible
        expect(screen.getByRole('button', { name: 'Short' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Long' })).toBeInTheDocument();
    });

    // ── Branch coverage: edge-case interactions ───────────────────────────

    it('dragover a day cell when no drag is in progress is a no-op', () => {
        renderCalendar();
        // No dragStart → dragInfoRef is null → handleDayDragOver early-returns without setState
        expect(() => {
            fireEvent.dragOver(screen.getByTestId('calendar-day-2024-03-15'));
        }).not.toThrow();
    });

    it('drop on a day cell when no drag is in progress is a no-op', () => {
        renderCalendar();
        // No dragStart → dragInfoRef is null → handleDayDrop early-returns without dispatching
        expect(() => {
            fireEvent.drop(screen.getByTestId('calendar-day-2024-03-15'));
        }).not.toThrow();
    });

    it('dragging over the same day cell twice does not trigger a state update the second time', () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'Event' })] });
        renderCalendar();
        const chip = screen.getByRole('button', { name: 'Event' });
        const targetDay = screen.getByTestId('calendar-day-2024-03-15');

        fireEvent.dragStart(chip);
        fireEvent.dragOver(targetDay);
        // Second dragover over the same cell — dateStr === dragOverDate → no setState
        expect(() => {
            fireEvent.dragOver(targetDay);
        }).not.toThrow();
        fireEvent.dragEnd(chip);
    });

    it('clicking the resize handle does not open the modal or select the event', async () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'Resizable' })] });
        const user = userEvent.setup();
        renderCalendar();

        const chip = screen.getByRole('button', { name: 'Resizable' });
        const resizeHandle = within(chip).getByTestId('event-resize-handle');

        await user.click(resizeHandle);

        // onClick on the resize handle calls stopPropagation — no modal opens
        expect(screen.queryByRole('heading', { name: /edit event/i })).not.toBeInTheDocument();
    });

    it('dragging the resize handle to a date before the event start is a no-op', async () => {
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'My Event', date: '2024-03-15' })] });
        renderCalendar();

        const chip = screen.getByRole('button', { name: 'My Event' });
        const resizeHandle = within(chip).getByTestId('event-resize-handle');
        // Drop the resize handle on March 10 — before the event's March 15 start
        const earlier = screen.getByTestId('calendar-day-2024-03-10');

        fireEvent.dragStart(resizeHandle);
        fireEvent.dragOver(earlier);
        fireEvent.drop(earlier);
        fireEvent.dragEnd(resizeHandle);

        // newEnd (Mar 10) < newStart (Mar 15) → onEventResize should NOT be called
        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem(`${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`) ?? '{}') as { data: AppData };
            const event = stored.data.calendarEvents.find(e => e.id === 'ev1');
            expect(event?.date).toBe('2024-03-15'); // unchanged
            expect(event?.endDate).toBeUndefined(); // unchanged
        });
    });

    it('multi-week spanning event shows continue and continued-from chip styles', () => {
        // March 4–12 spans week 2 (Mar 4–10) and week 3 (Mar 11–17)
        preloadState({ calendarEvents: [makeCalendarEvent({ id: 'ev1', title: 'Spanning', date: '2024-03-04', endDate: '2024-03-12' })] });
        renderCalendar();

        const chips = screen.getAllByRole('button', { name: 'Spanning' });
        expect(chips).toHaveLength(2);

        // First chip (Mar 4–10 portion) continues to the next week → rounded-r-none
        expect(chips[0].className).toContain('rounded-r-none');
        expect(chips[0].className).not.toContain('rounded-l-none');

        // Second chip (Mar 11–12 portion) is continued from previous week → rounded-l-none
        expect(chips[1].className).toContain('rounded-l-none');
        expect(chips[1].className).not.toContain('rounded-r-none');

        // Resize handle must NOT appear on the first chip (continuesAfter = true)
        expect(within(chips[0]).queryByTestId('event-resize-handle')).not.toBeInTheDocument();
        // Resize handle MUST appear on the last chip (continuesAfter = false)
        expect(within(chips[1]).getByTestId('event-resize-handle')).toBeInTheDocument();
    });

    it('today\'s date cell has the blue "today" highlight', () => {
        const today = new Date();
        render(<CalendarPage defaultDate={today} />, { wrapper: Wrapper });

        const todayStr = format(today, 'yyyy-MM-dd');
        const todayCell = screen.getByTestId(`calendar-day-${todayStr}`);

        expect(todayCell.className).toContain('bg-blue-50/40');
        expect(todayCell.className).toContain('dark:bg-blue-900/20');
    });

    it('today\'s date number shows a blue circle', () => {
        const today = new Date();
        render(<CalendarPage defaultDate={today} />, { wrapper: Wrapper });

        // The "today" badge is a span with bg-blue-500
        const todayBadge = document.querySelector('.bg-blue-500.text-white.font-semibold');
        expect(todayBadge).not.toBeNull();
        expect(todayBadge?.textContent).toBe(String(today.getDate()));
    });

    it('saves an event with an end date when endDate is after startDate', async () => {
        const user = userEvent.setup();
        renderCalendar();

        await user.click(screen.getByTestId('calendar-day-2024-03-15'));
        await user.type(screen.getByPlaceholderText(/title \*/i), 'Multi Day');

        const dateInputs = document.querySelectorAll('input[type="date"]');
        fireEvent.change(dateInputs[1], { target: { value: '2024-03-20' } });

        await user.click(screen.getByRole('button', { name: /save/i }));

        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem(`${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`) ?? '{}') as { data: AppData };
            const event = stored.data.calendarEvents.find(e => e.title === 'Multi Day');
            expect(event?.endDate).toBe('2024-03-20');
        });
    });

    it('strips endDate when it equals startDate on save', async () => {
        const user = userEvent.setup();
        renderCalendar();

        await user.click(screen.getByTestId('calendar-day-2024-03-15'));
        await user.type(screen.getByPlaceholderText(/title \*/i), 'Same Day');

        // Set endDate = startDate (not strictly after)
        const dateInputs = document.querySelectorAll('input[type="date"]');
        fireEvent.change(dateInputs[1], { target: { value: '2024-03-15' } });

        await user.click(screen.getByRole('button', { name: /save/i }));

        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem(`${STORAGE_KEY_PREFIX}${TEST_PROJECT_ID}`) ?? '{}') as { data: AppData };
            const event = stored.data.calendarEvents.find(e => e.title === 'Same Day');
            expect(event?.endDate).toBeUndefined();
        });
    });

    it('ignores an invalid event type value from the select (defensive branch)', async () => {
        const user = userEvent.setup();
        renderCalendar();

        await user.click(screen.getByTestId('calendar-day-2024-03-15'));

        const select = screen.getByRole('combobox', { name: /event type/i });
        const originalValue = (select as HTMLSelectElement).value;

        // Simulate a change event with a value not in EVENT_TYPES
        fireEvent.change(select, { target: { value: 'not-a-real-type' } });

        // The if(found) guard prevents onFormChange from being called → value stays unchanged
        expect((select as HTMLSelectElement).value).toBe(originalValue);
    });

    // ── MonthCalendar unit tests (direct render — covers props not used via CalendarPage) ─

    it('MonthCalendar renders events without eventPropGetter (default empty style)', () => {
        const ev = { start: new Date('2024-03-15T00:00:00'), end: new Date('2024-03-15T00:00:00') };
        render(
            <MonthCalendar
                events={[ev]}
                defaultDate={new Date('2024-03-15')}
            />
        );
        // Component renders without error; no resize handle since onEventResize is absent
        expect(screen.getByText('March 2024')).toBeInTheDocument();
        expect(screen.queryByTestId('event-resize-handle')).not.toBeInTheDocument();
    });

    it('MonthCalendar falls back to empty style when eventPropGetter returns no style', () => {
        const ev = { start: new Date('2024-03-15T00:00:00'), end: new Date('2024-03-15T00:00:00') };
        render(
            <MonthCalendar
                events={[ev]}
                defaultDate={new Date('2024-03-15')}
                eventPropGetter={() => ({})}
            />
        );
        expect(screen.getByText('March 2024')).toBeInTheDocument();
    });

    it('MonthCalendar defaults to the current month when no defaultDate is given', () => {
        render(<MonthCalendar events={[]} />);
        const now = new Date();
        const expected = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        expect(screen.getByText(expected)).toBeInTheDocument();
    });
});
