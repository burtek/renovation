import type { AppData, CalendarEvent, CalendarEventType, Expense, Task } from '../types';

import { generateReport } from './report';


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockWin() {
    return {
        document: { write: vi.fn(), close: vi.fn() },
        print: vi.fn()
    };
}

function captureHtml(mockWin: ReturnType<typeof makeMockWin>): string {
    return mockWin.document.write.mock.calls.map((c: unknown[]) => c[0]).join('');
}

const EMPTY_STATE: AppData = {
    notes: [],
    tasks: [],
    expenses: [],
    calendarEvents: [],
    budget: 0
};

function makeExpense(overrides: Partial<Expense> = {}): Expense {
    return {
        id: 'e1',
        description: 'Paint',
        date: '2024-01-15',
        price: 150,
        shopName: 'Leroy',
        invoiceNo: 'INV-001',
        invoiceForm: 'paper',
        loanApproved: false,
        ...overrides
    };
}

function makeTask(overrides: Partial<Task> = {}): Task {
    return {
        id: 't1',
        title: 'My Task',
        notes: '',
        startDate: '2024-01-01',
        endDate: '2024-01-10',
        assignee: 'Alice',
        dependsOn: [],
        subtasks: [],
        completed: false,
        ...overrides
    };
}

function makeCalendarEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
    return {
        id: 'ev1',
        title: 'Site visit',
        date: '2024-03-01',
        eventType: 'event' as CalendarEventType,
        contractor: 'Bob',
        notes: 'Bring the plans',
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateReport', () => {
    let mockWin: ReturnType<typeof makeMockWin>;

    beforeEach(() => {
        mockWin = makeMockWin();
        vi.stubGlobal('open', vi.fn(() => mockWin));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // ── window.open mechanics ─────────────────────────────────────────────

    it('calls window.open with "" and "_blank"', () => {
        generateReport(EMPTY_STATE);
        expect(window.open).toHaveBeenCalledWith('', '_blank');
    });

    it('calls document.write, document.close, and window.print', () => {
        generateReport(EMPTY_STATE);
        expect(mockWin.document.write).toHaveBeenCalledOnce();
        expect(mockWin.document.close).toHaveBeenCalledOnce();
        expect(mockWin.print).toHaveBeenCalledOnce();
    });

    it('does not throw when window.open returns null', () => {
        vi.stubGlobal('open', vi.fn(() => null));
        expect(() => generateReport(EMPTY_STATE)).not.toThrow();
    });

    // ── Budget summary ────────────────────────────────────────────────────

    it('shows remaining budget with blue class when remaining >= 0', () => {
        const state: AppData = { ...EMPTY_STATE, budget: 1000, expenses: [] };
        generateReport(state);
        const html = captureHtml(mockWin);
        // remaining = 1000 - 0 = 1000 → blue class
        expect(html).toContain('class="card-value blue"');
    });

    it('shows remaining budget with red class when remaining < 0', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            budget: 100,
            expenses: [makeExpense({ price: 200, loanApproved: false })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('class="card-value red"');
    });

    it('shows loan approved total', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            expenses: [makeExpense({ price: 300, loanApproved: true })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('Loan Approved');
    });

    it('shows not approved total', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            expenses: [makeExpense({ price: 200, loanApproved: false })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('Not Approved');
    });

    // ── Expenses section ──────────────────────────────────────────────────

    it('shows "No expenses." placeholder when expenses array is empty', () => {
        generateReport(EMPTY_STATE);
        const html = captureHtml(mockWin);
        expect(html).toContain('No expenses.');
    });

    it('shows expense count in section heading', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            expenses: [makeExpense(), makeExpense({ id: 'e2' })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('Expenses (2)');
    });

    it('renders expense description, date, price, shop, invoiceNo', () => {
        const state: AppData = { ...EMPTY_STATE, expenses: [makeExpense()] };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('Paint');
        expect(html).toContain('2024-01-15');
        expect(html).toContain('Leroy');
        expect(html).toContain('INV-001');
    });

    it('renders dash for empty shopName', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            expenses: [makeExpense({ shopName: '' })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('—');
    });

    it('renders dash for empty invoiceNo', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            expenses: [makeExpense({ invoiceNo: '' })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('—');
    });

    it('renders "paper" invoice form text', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            expenses: [makeExpense({ invoiceForm: 'paper' })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('paper');
    });

    it('renders ✓ for loan approved expenses', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            expenses: [makeExpense({ loanApproved: true })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('✓');
    });

    it('renders ✗ for non-approved expenses', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            expenses: [makeExpense({ loanApproved: false })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('✗');
    });

    it('renders a gdrive anchor for valid https invoiceLink', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            expenses: [makeExpense({ invoiceForm: 'gdrive', invoiceLink: 'https://drive.google.com/file/abc' })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('<a href="https://drive.google.com/file/abc"');
        expect(html).toContain('GDrive</a>');
    });

    it('renders a gdrive anchor for valid http invoiceLink', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            expenses: [makeExpense({ invoiceForm: 'gdrive', invoiceLink: 'http://drive.example.com/file' })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('<a href="http://drive.example.com/file"');
    });

    it('renders "GDrive (invalid link)" for javascript: invoiceLink', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            expenses: [makeExpense({ invoiceForm: 'gdrive', invoiceLink: 'javascript:alert(1)' })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('GDrive (invalid link)');
        expect(html).not.toContain('<a href="javascript:');
    });

    it('renders gdrive form text (no anchor) when invoiceLink is absent', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            expenses: [makeExpense({ invoiceForm: 'gdrive', invoiceLink: undefined })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        // Should show "gdrive" text but no anchor tag for it
        expect(html).not.toContain('<a href=');
    });

    it('HTML-escapes < > & " \' in description', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            expenses: [makeExpense({ description: '<script>&"\'</script>' })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('&lt;script&gt;&amp;&quot;&#39;&lt;/script&gt;');
        expect(html).not.toContain('<script>');
    });

    it('HTML-escapes special characters in shopName', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            expenses: [makeExpense({ shopName: '<b>Shop & Co</b>' })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('&lt;b&gt;Shop &amp; Co&lt;/b&gt;');
    });

    // ── Tasks section ─────────────────────────────────────────────────────

    it('shows "No tasks." placeholder when tasks array is empty', () => {
        generateReport(EMPTY_STATE);
        const html = captureHtml(mockWin);
        expect(html).toContain('No tasks.');
    });

    it('shows task count in section heading', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            tasks: [makeTask(), makeTask({ id: 't2', title: 'Task 2' })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('Tasks (2)');
    });

    it('renders task title, startDate, endDate, assignee', () => {
        const state: AppData = { ...EMPTY_STATE, tasks: [makeTask()] };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('My Task');
        expect(html).toContain('2024-01-01');
        expect(html).toContain('2024-01-10');
        expect(html).toContain('Alice');
    });

    it('renders task notes inside <small> tag', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            tasks: [makeTask({ notes: 'Important note' })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('<small>Important note</small>');
    });

    it('renders ✓ Done for completed tasks', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            tasks: [makeTask({ completed: true })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('✓ Done');
    });

    it('renders "In progress" for incomplete tasks', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            tasks: [makeTask({ completed: false })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('In progress');
    });

    it('renders subtasks with ✓ for completed subtasks', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            tasks: [
                makeTask({
                    subtasks: [
                        {
                            id: 's1',
                            parentId: 't1',
                            title: 'Subtask One',
                            notes: '',
                            completed: true
                        }
                    ]
                })
            ]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('Subtask One (✓)');
    });

    it('renders subtasks with ○ for incomplete subtasks', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            tasks: [
                makeTask({
                    subtasks: [
                        {
                            id: 's1',
                            parentId: 't1',
                            title: 'Subtask Two',
                            notes: '',
                            completed: false
                        }
                    ]
                })
            ]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('Subtask Two (○)');
    });

    it('renders dash for tasks with no subtasks', () => {
        const state: AppData = { ...EMPTY_STATE, tasks: [makeTask({ subtasks: [] })] };
        generateReport(state);
        const html = captureHtml(mockWin);
        // The subtasks column should contain the em dash
        expect(html).toContain('—');
    });

    it('renders dash when startDate is undefined', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            tasks: [makeTask({ startDate: undefined, endDate: undefined })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('—');
    });

    it('renders dash when assignee is undefined', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            tasks: [makeTask({ assignee: undefined })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('—');
    });

    // ── Calendar Events section ───────────────────────────────────────────

    it('shows "No events." placeholder when calendarEvents is empty', () => {
        generateReport(EMPTY_STATE);
        const html = captureHtml(mockWin);
        expect(html).toContain('No events.');
    });

    it('shows event count in section heading', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            calendarEvents: [makeCalendarEvent(), makeCalendarEvent({ id: 'ev2', title: 'Other' })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('Calendar events (2)');
    });

    it('renders event title, start date, contractor, eventType, notes', () => {
        const state: AppData = { ...EMPTY_STATE, calendarEvents: [makeCalendarEvent()] };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('Site visit');
        expect(html).toContain('2024-03-01');
        expect(html).toContain('Bob');
        expect(html).toContain('event');
        expect(html).toContain('Bring the plans');
    });

    it('uses endDate for end column when endDate is provided', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            calendarEvents: [makeCalendarEvent({ date: '2024-03-01', endDate: '2024-03-05' })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('2024-03-05');
    });

    it('falls back to start date for end column when endDate is absent', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            calendarEvents: [makeCalendarEvent({ date: '2024-03-10', endDate: undefined })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        // date '2024-03-10' should appear twice (start and end columns)
        const count = (html.match(/2024-03-10/g) ?? []).length;
        expect(count).toBeGreaterThanOrEqual(2);
    });

    it('renders dash when contractor is absent', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            calendarEvents: [makeCalendarEvent({ contractor: undefined })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('—');
    });


    it('renders dash when notes is absent', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            calendarEvents: [makeCalendarEvent({ notes: undefined })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('—');
    });

    it('renders dash when contractor is empty string', () => {
        const state: AppData = {
            ...EMPTY_STATE,
            calendarEvents: [makeCalendarEvent({ contractor: '' })]
        };
        generateReport(state);
        const html = captureHtml(mockWin);
        expect(html).toContain('—');
    });
});
