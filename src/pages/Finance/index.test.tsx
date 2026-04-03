import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AppProvider } from '../../contexts/AppContext';
import type { AppData, Expense } from '../../types';

import Finance from '.';


// Mock recharts to avoid SVG / ResizeObserver issues in jsdom
vi.mock('recharts', () => {
    const Mock = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
    return {

        PieChart: Mock,

        Pie: Mock,

        Cell: Mock,

        Tooltip: Mock,

        Legend: Mock,

        ResponsiveContainer: Mock
    };
});

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

function makeExpense(overrides: Partial<Expense> = {}): Expense {
    return {
        id: 'e1',
        description: 'Test Expense',
        date: '2024-01-01',
        price: 100,
        shopName: 'Shop',
        invoiceNo: 'INV-01',
        invoiceForm: 'paper',
        loanApproved: false,
        ...overrides
    };
}

function findButtonByText(container: HTMLElement, text: string): HTMLButtonElement | undefined {
    return [...container.querySelectorAll('button')].find(
        b => b.textContent?.trim() === text
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Finance page', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubGlobal('confirm', vi.fn(() => true));
        vi.stubGlobal('alert', vi.fn());
    });

    afterEach(() => {
        localStorage.clear();
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    // ── Basic rendering ───────────────────────────────────────────────────

    it('renders Finance heading', () => {
        render(<Finance />, { wrapper: Wrapper });
        expect(screen.getByRole('heading', { name: /finance/i })).toBeInTheDocument();
    });

    it('shows budget summary cards', () => {
        render(<Finance />, { wrapper: Wrapper });
        expect(screen.getByText('Loan Approved')).toBeInTheDocument();
        expect(screen.getByText('Not Approved')).toBeInTheDocument();
        expect(screen.getByText('Remaining Budget')).toBeInTheDocument();
    });

    it('shows "No expenses yet." in both mobile and desktop views when there are no expenses', () => {
        render(<Finance />, { wrapper: Wrapper });
        const noExpTexts = screen.getAllByText(/no expenses yet/i);
        expect(noExpTexts.length).toBeGreaterThanOrEqual(1);
    });

    // ── todayLocalDate (KEY TEST) ─────────────────────────────────────────

    it('pre-fills today\'s local date in the date input when "+ Add Expense" is clicked', async () => {
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add expense/i }));

        // Compute expected date using the same algorithm as todayLocalDate()
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        const expected = d.toISOString().split('T')[0];

        const [dateInput] = screen.getAllByDisplayValue(expected);
        expect(dateInput).toBeInTheDocument();
    });

    // ── safeUrl (KEY TEST via expense rendering) ──────────────────────────

    it('renders a clickable link for gdrive expense with https invoiceLink', () => {
        preloadState({
            expenses: [
                makeExpense({
                    id: 'e1',
                    invoiceForm: 'gdrive',
                    invoiceLink: 'https://drive.google.com/file/abc123'
                })
            ]
        });
        render(<Finance />, { wrapper: Wrapper });
        const links = screen.getAllByRole('link', { name: /gdrive/i });
        expect(links.length).toBeGreaterThan(0);
        expect(links[0]).toHaveAttribute('href', 'https://drive.google.com/file/abc123');
    });

    it('shows "GDrive (invalid link)" for javascript: invoiceLink (no anchor)', () => {
        // Use an unsafe-protocol URL — stored as data, not evaluated
        const unsafeUrl = ['javascript', ':', 'alert(1)'].join('');
        preloadState({
            expenses: [
                makeExpense({
                    id: 'e1',
                    invoiceForm: 'gdrive',
                    invoiceLink: unsafeUrl
                })
            ]
        });
        render(<Finance />, { wrapper: Wrapper });
        expect(screen.getAllByText('GDrive (invalid link)').length).toBeGreaterThan(0);
        expect(screen.queryByRole('link', { name: /gdrive/i })).not.toBeInTheDocument();
    });

    it('shows invoice form text (no anchor) when gdrive invoiceLink is absent', () => {
        preloadState({
            expenses: [
                makeExpense({
                    id: 'e1',
                    invoiceForm: 'gdrive',
                    invoiceLink: undefined
                })
            ]
        });
        render(<Finance />, { wrapper: Wrapper });
        expect(screen.queryByRole('link', { name: /gdrive/i })).not.toBeInTheDocument();
    });

    // ── Add expense ───────────────────────────────────────────────────────

    it('adds an expense and shows it in the list', async () => {
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add expense/i }));
        await user.type(screen.getByPlaceholderText(/description \*/i), 'New Paint');

        const priceInput = screen.getByPlaceholderText(/price \*/i);
        await user.type(priceInput, '250');

        await user.click(screen.getByRole('button', { name: /save/i }));

        await waitFor(() => {
            expect(screen.getAllByText('New Paint').length).toBeGreaterThan(0);
        });
    });

    it('does not add expense when description is empty', async () => {
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add expense/i }));
        const priceInput = screen.getByPlaceholderText(/price \*/i);
        await user.type(priceInput, '100');

        await user.click(screen.getByRole('button', { name: /save/i }));

        // Modal should still be open
        expect(screen.getByRole('heading', { name: /new expense/i })).toBeInTheDocument();
    });

    it('does not add expense when price is invalid', async () => {
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add expense/i }));
        await user.type(screen.getByPlaceholderText(/description \*/i), 'Valid Desc');
        await user.type(screen.getByPlaceholderText(/price \*/i), 'not-a-number');

        await user.click(screen.getByRole('button', { name: /save/i }));

        expect(screen.getByRole('heading', { name: /new expense/i })).toBeInTheDocument();
    });

    it('Cancel button closes the modal', async () => {
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add expense/i }));
        expect(screen.getByRole('heading', { name: /new expense/i })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /cancel/i }));
        expect(screen.queryByRole('heading', { name: /new expense/i })).not.toBeInTheDocument();
    });

    // ── Edit expense ──────────────────────────────────────────────────────

    it('opens edit modal with pre-filled values', async () => {
        preloadState({ expenses: [makeExpense({ id: 'e1', description: 'Old Desc', price: 200 })] });
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        const editButtons = screen.getAllByRole('button', { name: /^edit$/i });
        await user.click(editButtons[0]);

        expect(screen.getByDisplayValue('Old Desc')).toBeInTheDocument();
        expect(screen.getByDisplayValue('200')).toBeInTheDocument();
    });

    it('updates description after editing', async () => {
        preloadState({ expenses: [makeExpense({ id: 'e1', description: 'Old Desc' })] });
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        const editButtons = screen.getAllByRole('button', { name: /^edit$/i });
        await user.click(editButtons[0]);

        const descInput = screen.getByDisplayValue('Old Desc');
        await user.clear(descInput);
        await user.type(descInput, 'New Desc');

        await user.click(screen.getByRole('button', { name: /save/i }));

        await waitFor(() => {
            expect(screen.getAllByText('New Desc').length).toBeGreaterThan(0);
        });
    });

    // ── Delete expense ────────────────────────────────────────────────────

    it('deletes an expense when confirmed', async () => {
        vi.stubGlobal('confirm', vi.fn(() => true));
        preloadState({ expenses: [makeExpense({ id: 'e1', description: 'Delete Me' })] });
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        const delButtons = screen.getAllByRole('button', { name: /^del$/i });
        await user.click(delButtons[0]);

        await waitFor(() => {
            expect(screen.queryByText('Delete Me')).not.toBeInTheDocument();
        });
    });

    it('keeps an expense when delete is not confirmed', async () => {
        vi.stubGlobal('confirm', vi.fn(() => false));
        preloadState({ expenses: [makeExpense({ id: 'e1', description: 'Keep Me' })] });
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        const delButtons = screen.getAllByRole('button', { name: /^del$/i });
        await user.click(delButtons[0]);

        expect(screen.getAllByText('Keep Me').length).toBeGreaterThan(0);
    });

    // ── Budget input ──────────────────────────────────────────────────────

    it('persists budget to localStorage on blur', async () => {
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        const budgetInput = screen.getByRole('spinbutton');
        await user.clear(budgetInput);
        await user.type(budgetInput, '50000');
        await user.tab(); // triggers blur

        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem('renovation-data') ?? '{}') as AppData;
            expect(stored.budget).toBe(50000);
        });
    });

    it('does not update budget for invalid input', async () => {
        preloadState({ budget: 1000 });
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        const budgetInput = screen.getByRole('spinbutton');
        await user.clear(budgetInput);
        await user.type(budgetInput, 'abc');
        await user.tab();

        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem('renovation-data') ?? '{}') as AppData;
            expect(stored.budget).toBe(1000);
        });
    });

    // ── Pie chart ─────────────────────────────────────────────────────────

    it('renders pie chart when total expenses > 0', () => {
        preloadState({ expenses: [makeExpense({ id: 'e1', price: 500 })] });
        render(<Finance />, { wrapper: Wrapper });
        // With recharts mocked, the PieChart renders when total > 0.
        // The expense description appears in the list (mobile + desktop views).
        const descriptions = screen.getAllByText('Test Expense');
        expect(descriptions.length).toBeGreaterThan(0);
    });

    // ── gdrive invoice form ───────────────────────────────────────────────

    it('shows Google Drive link input when gdrive is selected in the form', async () => {
        const user = userEvent.setup();
        const { container } = render(<Finance />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add expense/i }));

        // Use the actual <select> element (not the shop name datalist input which also has combobox role)
        const select = container.querySelector('select') as HTMLSelectElement;
        await user.selectOptions(select, 'gdrive');

        expect(screen.getByPlaceholderText(/google drive link/i)).toBeInTheDocument();
    });

    // ── loanApproved checkbox ─────────────────────────────────────────────

    it('toggles loanApproved checkbox', async () => {
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add expense/i }));

        const loanCheckbox = screen.getByRole('checkbox', { name: /loan approved/i });
        expect(loanCheckbox).not.toBeChecked();

        await user.click(loanCheckbox);
        expect(loanCheckbox).toBeChecked();
    });

    // ── Shop datalist ─────────────────────────────────────────────────────

    it('shows shop name datalist', async () => {
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add expense/i }));

        expect(document.getElementById('shop-suggestions')).toBeInTheDocument();
    });

    // ── Loan approved indicator ───────────────────────────────────────────

    it('shows ✓ Loan indicator for loan-approved expense (mobile view)', () => {
        preloadState({ expenses: [makeExpense({ id: 'e1', loanApproved: true })] });
        render(<Finance />, { wrapper: Wrapper });
        expect(screen.getAllByText(/✓ Loan/).length).toBeGreaterThan(0);
    });

    // ── Report button ─────────────────────────────────────────────────────

    it('calls window.open when Report button is clicked', async () => {
        const mockWin = { document: { write: vi.fn(), close: vi.fn() }, print: vi.fn() };
        vi.stubGlobal('open', vi.fn(() => mockWin));

        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /report/i }));

        expect(window.open).toHaveBeenCalledWith('', '_blank');
    });

    // ── Sorting (new feature from master) ────────────────────────────────

    it('sorts expenses by date descending by default (most recent first)', () => {
        preloadState({
            expenses: [
                makeExpense({ id: 'e1', description: 'Older', date: '2024-01-01', price: 10 }),
                makeExpense({ id: 'e2', description: 'Newer', date: '2024-06-15', price: 20 })
            ]
        });
        render(<Finance />, { wrapper: Wrapper });

        // The mobile card view renders in order — check relative position
        const items = screen.getAllByText(/Newer|Older/);
        const newerIndex = items.findIndex(el => el.textContent === 'Newer');
        const olderIndex = items.findIndex(el => el.textContent === 'Older');
        expect(newerIndex).toBeLessThan(olderIndex);
    });

    it('sorts expenses by description ascending when Description header is clicked', async () => {
        preloadState({
            expenses: [
                makeExpense({ id: 'e1', description: 'Zebra', date: '2024-01-01', price: 10 }),
                makeExpense({ id: 'e2', description: 'Apple', date: '2024-06-15', price: 20 })
            ]
        });
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        // Click the "Description" sort button in the desktop table header
        await user.click(screen.getByRole('button', { name: /^description$/i }));

        const items = screen.getAllByText(/Zebra|Apple/);
        const appleIndex = items.findIndex(el => el.textContent === 'Apple');
        const zebraIndex = items.findIndex(el => el.textContent === 'Zebra');
        expect(appleIndex).toBeLessThan(zebraIndex);
    });

    it('toggles sort to descending when the active sort column header is clicked again', async () => {
        preloadState({
            expenses: [
                makeExpense({ id: 'e1', description: 'Apple', date: '2024-01-01', price: 10 }),
                makeExpense({ id: 'e2', description: 'Zebra', date: '2024-06-15', price: 20 })
            ]
        });
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        // First click: sort by description asc
        await user.click(screen.getByRole('button', { name: /^description$/i }));
        // Second click: toggle to desc
        await user.click(screen.getByRole('button', { name: /^description/i }));

        const items = screen.getAllByText(/Zebra|Apple/);
        const zebraIndex = items.findIndex(el => el.textContent === 'Zebra');
        const appleIndex = items.findIndex(el => el.textContent === 'Apple');
        expect(zebraIndex).toBeLessThan(appleIndex);
    });

    it('shows the sort direction arrow on the active column header', async () => {
        preloadState({ expenses: [makeExpense({ id: 'e1', description: 'A', date: '2024-01-01', price: 10 })] });
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        // Default: date column shows ↓ (descending)
        const dateHeader = screen.getByRole('columnheader', { name: /date/i });
        expect(dateHeader.textContent).toContain('↓');

        // Click Description: Description shows ↑ (ascending)
        await user.click(screen.getByRole('button', { name: /^description$/i }));
        const descHeader = screen.getByRole('columnheader', { name: /description/i });
        expect(descHeader.textContent).toContain('↑');
    });

    it('sets aria-sort="descending" on the active column header by default', () => {
        preloadState({ expenses: [makeExpense({ id: 'e1' })] });
        render(<Finance />, { wrapper: Wrapper });

        const dateHeader = screen.getByRole('columnheader', { name: /date/i });
        expect(dateHeader).toHaveAttribute('aria-sort', 'descending');
    });

    it('sets aria-sort="ascending" after clicking a column header', async () => {
        preloadState({ expenses: [makeExpense({ id: 'e1' })] });
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /^description$/i }));

        const descHeader = screen.getByRole('columnheader', { name: /description/i });
        expect(descHeader).toHaveAttribute('aria-sort', 'ascending');
    });

    it('sorts by price numerically', async () => {
        preloadState({
            expenses: [
                makeExpense({ id: 'e1', description: 'Cheap', date: '2024-01-01', price: 10 }),
                makeExpense({ id: 'e2', description: 'Expensive', date: '2024-01-02', price: 9999 })
            ]
        });
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /^price$/i }));

        const items = screen.getAllByText(/^Cheap$|^Expensive$/);
        const cheapIndex = items.findIndex(el => el.textContent === 'Cheap');
        const expensiveIndex = items.findIndex(el => el.textContent === 'Expensive');
        expect(cheapIndex).toBeLessThan(expensiveIndex); // asc: cheap first
    });

    it('shows "GDrive (invalid link)" for a completely malformed invoiceLink (safeUrl catch)', () => {
        preloadState({
            expenses: [
                makeExpense({
                    id: 'e1',
                    invoiceForm: 'gdrive',
                    invoiceLink: 'not a url at all'
                })
            ]
        });
        render(<Finance />, { wrapper: Wrapper });
        expect(screen.getAllByText('GDrive (invalid link)').length).toBeGreaterThan(0);
    });

    it('deletes an expense via the mobile card Delete button', async () => {
        vi.stubGlobal('confirm', vi.fn(() => true));
        preloadState({ expenses: [makeExpense({ id: 'e1', description: 'Mobile Delete Me' })] });
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        // Mobile card renders "Delete" (full word), desktop renders "Del"
        const deleteButtons = screen.getAllByRole('button', { name: /^delete$/i });
        await user.click(deleteButtons[0]);

        await waitFor(() => {
            expect(screen.queryByText('Mobile Delete Me')).not.toBeInTheDocument();
        });
    });

    it('typing in the Google Drive link input updates the form value', async () => {
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add expense/i }));

        // Switch to gdrive
        const select = document.body.querySelector('select') as HTMLSelectElement;
        await user.selectOptions(select, 'gdrive');

        const gdriveLinkInput = screen.getByPlaceholderText(/google drive link/i);
        await user.type(gdriveLinkInput, 'https://drive.google.com/test');

        expect(gdriveLinkInput).toHaveValue('https://drive.google.com/test');
    });

    it('expense date field onChange is wired up — saved expense has the entered date', async () => {
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add expense/i }));
        await user.type(screen.getByPlaceholderText(/description \*/i), 'Date Test');

        // Change the date input
        const dateInputs = document.querySelectorAll('input[type="date"]');
        fireEvent.change(dateInputs[0], { target: { value: '2024-06-15' } });

        await user.type(screen.getByPlaceholderText(/price \*/i), '50');
        await user.click(screen.getByRole('button', { name: /save/i }));

        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem('renovation-data') ?? '{}') as AppData;
            const saved = stored.expenses.find((e: { description: string }) => e.description === 'Date Test');
            expect(saved?.date).toBe('2024-06-15');
        });
    });

    it('expense shopName field onChange is wired up — saved expense has the entered shop name', async () => {
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add expense/i }));
        await user.type(screen.getByPlaceholderText(/description \*/i), 'Shop Test');
        await user.type(screen.getByPlaceholderText(/price \*/i), '75');
        await user.type(screen.getByPlaceholderText(/shop name/i), 'IKEA');
        await user.click(screen.getByRole('button', { name: /save/i }));

        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem('renovation-data') ?? '{}') as AppData;
            const saved = stored.expenses.find((e: { description: string }) => e.description === 'Shop Test');
            expect(saved?.shopName).toBe('IKEA');
        });
    });

    it('expense invoiceNo field onChange is wired up — saved expense has the entered invoice number', async () => {
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add expense/i }));
        await user.type(screen.getByPlaceholderText(/description \*/i), 'Invoice Test');
        await user.type(screen.getByPlaceholderText(/price \*/i), '200');
        await user.type(screen.getByPlaceholderText(/invoice no/i), 'FV-2024-999');
        await user.click(screen.getByRole('button', { name: /save/i }));

        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem('renovation-data') ?? '{}') as AppData;
            const saved = stored.expenses.find((e: { description: string }) => e.description === 'Invoice Test');
            expect(saved?.invoiceNo).toBe('FV-2024-999');
        });
    });

    it('desktop table Del button triggers delete', async () => {
        vi.stubGlobal('confirm', vi.fn(() => true));
        preloadState({ expenses: [makeExpense({ id: 'e1', description: 'Desktop Delete Test' })] });
        const { container } = render(<Finance />, { wrapper: Wrapper });

        // Use querySelectorAll to find "Del" button regardless of ARIA visibility filtering
        const delBtn = findButtonByText(container, 'Del');
        expect(delBtn).toBeDefined();
        fireEvent.click(delBtn!);

        await waitFor(() => {
            expect(screen.queryByText('Desktop Delete Test')).not.toBeInTheDocument();
        });
    });

    it('desktop table Edit button opens the edit modal', async () => {
        preloadState({ expenses: [makeExpense({ id: 'e1', description: 'Desktop Edit Test', price: 123 })] });
        const { container } = render(<Finance />, { wrapper: Wrapper });

        // Use querySelectorAll to find all "Edit" buttons — [0] is mobile card, [1] is desktop table
        const editBtns = [...container.querySelectorAll('button')].filter(
            b => b.textContent?.trim() === 'Edit'
        );
        expect(editBtns.length).toBeGreaterThanOrEqual(2); // mobile + desktop

        // Click the desktop table Edit button
        fireEvent.click(editBtns[1]);

        expect(screen.getByRole('heading', { name: /edit expense/i })).toBeInTheDocument();
        expect(screen.getByDisplayValue('Desktop Edit Test')).toBeInTheDocument();
    });

    it('sorts by loanApproved (boolean) — unapproved first when ascending', async () => {
        preloadState({
            expenses: [
                makeExpense({ id: 'e1', description: 'Approved', date: '2024-01-01', loanApproved: true }),
                makeExpense({ id: 'e2', description: 'NotApproved', date: '2024-01-02', loanApproved: false })
            ]
        });
        const user = userEvent.setup();
        render(<Finance />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /^loan$/i }));

        const items = screen.getAllByText(/^Approved$|^NotApproved$/);
        const notApprovedIndex = items.findIndex(el => el.textContent === 'NotApproved');
        const approvedIndex = items.findIndex(el => el.textContent === 'Approved');
        expect(notApprovedIndex).toBeLessThan(approvedIndex);
    });
});
