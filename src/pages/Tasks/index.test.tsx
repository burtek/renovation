import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AppProvider } from '../../contexts/AppContext';
import type { Subtask, Task } from '../../types';

import Tasks from '.';


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

function preloadTasks(tasks: Task[]) {
    localStorage.setItem(
        'renovation-data',
        JSON.stringify({ notes: [], tasks, expenses: [], calendarEvents: [], budget: 0 })
    );
}

function makeTask(overrides: Partial<Task> = {}): Task {
    return {
        id: 't1',
        title: 'My Task',
        notes: '',
        completed: false,
        subtasks: [],
        dependsOn: [],
        ...overrides
    };
}

function makeSubtask(overrides: Partial<Subtask> = {}): Subtask {
    return {
        id: 's1',
        parentId: 't1',
        title: 'My Subtask',
        notes: '',
        completed: false,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Tasks page', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubGlobal('confirm', vi.fn(() => true));
    });

    afterEach(() => {
        localStorage.clear();
        vi.unstubAllGlobals();
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    // ── Empty state ───────────────────────────────────────────────────────

    it('shows "No tasks yet. Create one!" when there are no tasks', () => {
        render(<Tasks />, { wrapper: Wrapper });
        expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
    });

    // ── Tab switching ─────────────────────────────────────────────────────

    it('switches to Gantt tab when Gantt is clicked', async () => {
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /gantt/i }));

        // Gantt tab shows empty gantt state
        expect(screen.getByText(/no tasks or subtasks with start and end dates/i)).toBeInTheDocument();
    });

    it('switches back to List tab when List is clicked', async () => {
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /gantt/i }));
        await user.click(screen.getByRole('button', { name: /list/i }));

        expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
    });

    // ── Add task ──────────────────────────────────────────────────────────

    it('adds a task when title is filled and Save is clicked', async () => {
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add task/i }));
        await user.type(screen.getByPlaceholderText(/title \*/i), 'New Task Title');
        await user.click(screen.getByRole('button', { name: /save/i }));

        await waitFor(() => {
            expect(screen.getByText('New Task Title')).toBeInTheDocument();
        });
    });

    it('does not add a task when title is empty', async () => {
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add task/i }));
        await user.click(screen.getByRole('button', { name: /save/i }));

        // Modal should still be open
        expect(screen.getByRole('heading', { name: /new task/i })).toBeInTheDocument();
    });

    it('fills task form notes, dates, and assignee fields', async () => {
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add task/i }));
        await user.type(screen.getByPlaceholderText(/title \*/i), 'Task With Fields');
        await user.type(screen.getByPlaceholderText(/^notes$/i), 'Some task notes');

        const dateInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="date"]'));
        fireEvent.change(dateInputs[0], { target: { value: '2024-04-01' } });
        fireEvent.change(dateInputs[1], { target: { value: '2024-04-10' } });

        await user.type(screen.getByPlaceholderText(/assignee/i), 'Alice');

        const completedCheckbox = screen.getByRole('checkbox', { name: /completed/i });
        await user.click(completedCheckbox);
        expect(completedCheckbox).toBeChecked();

        await user.click(screen.getByRole('button', { name: /save/i }));

        await waitFor(() => {
            expect(screen.getByText('Task With Fields')).toBeInTheDocument();
        });
    });

    it('Cancel closes the task modal without saving', async () => {
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add task/i }));
        await user.type(screen.getByPlaceholderText(/title \*/i), 'Cancelled Task');

        await user.click(screen.getByRole('button', { name: /cancel/i }));

        expect(screen.queryByText('Cancelled Task')).not.toBeInTheDocument();
    });

    it('task form: changing startDate defaults endDate to startDate when endDate is blank', async () => {
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add task/i }));

        const [startInput, endInput] = Array.from(
            document.querySelectorAll<HTMLInputElement>('input[type="date"]')
        );

        // Clear endDate first so the || fallback fires when startDate changes
        fireEvent.change(endInput, { target: { value: '' } });
        fireEvent.change(startInput, { target: { value: '2024-05-01' } });

        expect(endInput.value).toBe('2024-05-01');
    });

    it('shows "Depends on (tasks)" when adding a task and other tasks exist', async () => {
        preloadTasks([makeTask({ id: 't1', title: 'Existing Task' })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add task/i }));

        expect(screen.getByText(/depends on \(tasks\)/i)).toBeInTheDocument();
        expect(screen.getAllByText('Existing Task').length).toBeGreaterThanOrEqual(2);
    });

    it('selecting a task dependency checkbox adds it to dependsOn', async () => {
        preloadTasks([makeTask({ id: 't1', title: 'Dep Task' })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add task/i }));

        const depCheckbox = screen.getByRole('checkbox', { name: /Dep Task/i });
        await user.click(depCheckbox);
        expect(depCheckbox).toBeChecked();

        await user.click(depCheckbox);
        expect(depCheckbox).not.toBeChecked();
    });

    it('completed task shown with line-through in task dep list', async () => {
        preloadTasks([makeTask({ id: 't1', title: 'Completed Task', completed: true })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add task/i }));

        // The completed task should appear in dep list with line-through
        const completedLabel = screen.getByRole('checkbox', { name: /Completed Task/i })
            .closest('label');
        expect(completedLabel?.querySelector('span')?.className).toContain('line-through');
    });

    // ── Edit task ─────────────────────────────────────────────────────────

    it('edits a task: changes title and saves', async () => {
        preloadTasks([makeTask({ id: 't1', title: 'Old Title' })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /^edit$/i }));

        const titleInput = screen.getByDisplayValue('Old Title');
        await user.clear(titleInput);
        await user.type(titleInput, 'New Title');

        await user.click(screen.getByRole('button', { name: /save/i }));

        await waitFor(() => {
            expect(screen.getByText('New Title')).toBeInTheDocument();
        });
    });

    // ── Delete task ───────────────────────────────────────────────────────

    it('deletes a task when confirmed', async () => {
        vi.stubGlobal('confirm', vi.fn(() => true));
        preloadTasks([makeTask({ id: 't1', title: 'Delete Me' })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /^delete$/i }));

        await waitFor(() => {
            expect(screen.queryByText('Delete Me')).not.toBeInTheDocument();
        });
    });

    it('keeps a task when delete is not confirmed', async () => {
        vi.stubGlobal('confirm', vi.fn(() => false));
        preloadTasks([makeTask({ id: 't1', title: 'Keep Me' })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /^delete$/i }));

        expect(screen.getByText('Keep Me')).toBeInTheDocument();
    });

    // ── Toggle task complete ──────────────────────────────────────────────

    it('toggles task completion: applies line-through style', async () => {
        preloadTasks([makeTask({ id: 't1', title: 'Incomplete Task' })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        const checkbox = screen.getByTitle('Toggle complete');
        await user.click(checkbox);

        await waitFor(() => {
            const titleEl = screen.getByText('Incomplete Task');
            expect(titleEl.className).toContain('line-through');
        });
    });

    // ── Subtasks ──────────────────────────────────────────────────────────

    it('adds a subtask to a task', async () => {
        preloadTasks([makeTask({ id: 't1', title: 'Parent Task' })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ subtask/i }));
        await user.type(screen.getByPlaceholderText(/title \*/i), 'My Subtask');
        await user.click(screen.getByRole('button', { name: /save/i }));

        // Expand the subtasks
        await waitFor(() => {
            const expandBtn = screen.queryByText('▼');
            return expandBtn !== null;
        });

        const expandBtn = screen.getByText('▼');
        await user.click(expandBtn);

        await waitFor(() => {
            expect(screen.getByText('My Subtask')).toBeInTheDocument();
        });
    });

    it('edits a subtask title', async () => {
        preloadTasks([
            makeTask({
                id: 't1',
                title: 'Parent',
                subtasks: [makeSubtask({ id: 's1', parentId: 't1', title: 'Old Sub' })]
            })
        ]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        // Expand subtasks
        await user.click(screen.getByText('▼'));

        // Click Edit on the subtask
        const editButtons = screen.getAllByRole('button', { name: /^edit$/i });
        // Last edit button is the subtask's
        await user.click(editButtons[editButtons.length - 1]);

        const titleInput = screen.getByDisplayValue('Old Sub');
        await user.clear(titleInput);
        await user.type(titleInput, 'New Sub');

        await user.click(screen.getByRole('button', { name: /save/i }));

        await waitFor(() => {
            expect(screen.getByText('New Sub')).toBeInTheDocument();
        });
    });

    it('deletes a subtask when confirmed', async () => {
        vi.stubGlobal('confirm', vi.fn(() => true));
        preloadTasks([
            makeTask({
                id: 't1',
                title: 'Parent',
                subtasks: [makeSubtask({ id: 's1', parentId: 't1', title: 'Del Sub' })]
            })
        ]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByText('▼'));
        await user.click(screen.getByRole('button', { name: /^del$/i }));

        await waitFor(() => {
            expect(screen.queryByText('Del Sub')).not.toBeInTheDocument();
        });
    });

    it('does not save subtask when title is empty', async () => {
        preloadTasks([makeTask({ id: 't1', title: 'Parent' })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ subtask/i }));
        // Do NOT type a title
        await user.click(screen.getByRole('button', { name: /save/i }));

        // Modal should still be open (title is required)
        expect(screen.getByPlaceholderText(/title \*/i)).toBeInTheDocument();
    });

    it('shifts dependent subtask dates when subtask endDate is extended (confirm=true)', async () => {
        vi.stubGlobal('confirm', vi.fn(() => true));

        const subA = makeSubtask({ id: 'sA', parentId: 't1', title: 'Sub A', startDate: '2024-01-01', endDate: '2024-01-10', dependsOn: [] });
        const subB = makeSubtask({ id: 'sB', parentId: 't1', title: 'Sub B', startDate: '2024-01-11', endDate: '2024-01-20', dependsOn: ['sA'] });
        preloadTasks([makeTask({ id: 't1', title: 'Parent', subtasks: [subA, subB] })]);

        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        // Expand subtasks
        await user.click(screen.getByText('▼'));

        // Edit Sub A
        const editButtons = screen.getAllByRole('button', { name: /^edit$/i });
        await user.click(editButtons[editButtons.length - 2]); // first subtask's Edit button

        // Extend Sub A's endDate by 5 days
        const endDateInput = screen.getByDisplayValue('2024-01-10');
        fireEvent.change(endDateInput, { target: { value: '2024-01-15' } });

        await user.click(screen.getByRole('button', { name: /save/i }));

        // Sub B should shift by 5 days: start=2024-01-16, end=2024-01-25
        await waitFor(() => {
            expect(screen.getByText(/2024-01-16/)).toBeInTheDocument();
            expect(screen.getByText(/2024-01-25/)).toBeInTheDocument();
        });
    });

    it('does NOT shift dependent subtask dates when subtask date shift is declined (confirm=false)', async () => {
        vi.stubGlobal('confirm', vi.fn(() => false));

        const subA = makeSubtask({ id: 'sA', parentId: 't1', title: 'Sub A', startDate: '2024-01-01', endDate: '2024-01-10', dependsOn: [] });
        const subB = makeSubtask({ id: 'sB', parentId: 't1', title: 'Sub B', startDate: '2024-01-11', endDate: '2024-01-20', dependsOn: ['sA'] });
        preloadTasks([makeTask({ id: 't1', title: 'Parent', subtasks: [subA, subB] })]);

        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByText('▼'));

        const editButtons = screen.getAllByRole('button', { name: /^edit$/i });
        await user.click(editButtons[editButtons.length - 2]);

        const endDateInput = screen.getByDisplayValue('2024-01-10');
        fireEvent.change(endDateInput, { target: { value: '2024-01-15' } });

        await user.click(screen.getByRole('button', { name: /save/i }));

        // Sub B dates should remain unchanged (confirm=false returns early)
        await waitFor(() => {
            expect(screen.getByText(/2024-01-11/)).toBeInTheDocument();
            expect(screen.getByText(/2024-01-20/)).toBeInTheDocument();
        });
    });

    // ── addDays / dayDiff via date shift ──────────────────────────────────

    it('shifts dependent task dates when endDate is extended (confirm=true)', async () => {
        vi.stubGlobal('confirm', vi.fn(() => true));

        const taskA: Task = makeTask({
            id: 'a',
            title: 'Task A',
            startDate: '2024-01-01',
            endDate: '2024-01-10',
            dependsOn: []
        });
        const taskB: Task = makeTask({
            id: 'b',
            title: 'Task B',
            startDate: '2024-01-11',
            endDate: '2024-01-20',
            dependsOn: ['a']
        });
        preloadTasks([taskA, taskB]);

        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        // Click Edit on the first task (Task A)
        const editBtns = screen.getAllByRole('button', { name: /^edit$/i });
        await user.click(editBtns[0]);

        // Change endDate from '2024-01-10' to '2024-01-15' (+5 days)
        const endDateInput = screen.getByDisplayValue('2024-01-10');
        fireEvent.change(endDateInput, { target: { value: '2024-01-15' } });

        await user.click(screen.getByRole('button', { name: /save/i }));

        // Task B should shift by 5 days: start=2024-01-16, end=2024-01-25
        await waitFor(() => {
            expect(screen.getByText(/2024-01-16/)).toBeInTheDocument();
            expect(screen.getByText(/2024-01-25/)).toBeInTheDocument();
        });
    });

    it('does NOT shift dependent task dates when endDate shift is declined (confirm=false)', async () => {
        vi.stubGlobal('confirm', vi.fn(() => false));

        const taskA: Task = makeTask({
            id: 'a',
            title: 'Task A',
            startDate: '2024-01-01',
            endDate: '2024-01-10',
            dependsOn: []
        });
        const taskB: Task = makeTask({
            id: 'b',
            title: 'Task B',
            startDate: '2024-01-11',
            endDate: '2024-01-20',
            dependsOn: ['a']
        });
        preloadTasks([taskA, taskB]);

        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        const editBtns = screen.getAllByRole('button', { name: /^edit$/i });
        await user.click(editBtns[0]);

        const endDateInput = screen.getByDisplayValue('2024-01-10');
        fireEvent.change(endDateInput, { target: { value: '2024-01-15' } });

        await user.click(screen.getByRole('button', { name: /save/i }));

        // Task B dates should remain unchanged (modal closed because confirm=false returns early)
        // Actually looking at saveTask: if proceed=false, it returns early without saving task A either.
        // So modal stays open. Task B is unchanged.
        await waitFor(() => {
            expect(screen.getByText(/2024-01-11/)).toBeInTheDocument();
            expect(screen.getByText(/2024-01-20/)).toBeInTheDocument();
        });
    });

    it('does not prompt for date shift when endDate is not changed', async () => {
        const mockConfirm = vi.fn(() => true);
        vi.stubGlobal('confirm', mockConfirm);

        preloadTasks([makeTask({ id: 't1', title: 'Task A', startDate: '2024-01-01', endDate: '2024-01-10' })]);

        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /^edit$/i }));
        // Don't change endDate
        await user.click(screen.getByRole('button', { name: /save/i }));

        // confirm should NOT have been called (no date shift prompt)
        expect(mockConfirm).not.toHaveBeenCalled();
    });

    // ── Gantt chart ───────────────────────────────────────────────────────

    it('shows Gantt SVG when tasks have startDate and endDate', async () => {
        preloadTasks([
            makeTask({
                id: 't1',
                title: 'Gantt Task',
                startDate: '2024-01-01',
                endDate: '2024-01-10'
            })
        ]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /gantt/i }));

        await waitFor(() => {
            expect(document.querySelector('svg')).toBeInTheDocument();
        });
    });

    it('shows empty Gantt message when tasks have no dates', async () => {
        preloadTasks([makeTask({ id: 't1', title: 'No Dates Task' })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /gantt/i }));

        expect(screen.getByText(/no tasks or subtasks with start and end dates/i)).toBeInTheDocument();
    });

    it('renders dependency polylines in Gantt for tasks with dependsOn', async () => {
        preloadTasks([
            makeTask({ id: 'a', title: 'A', startDate: '2024-01-01', endDate: '2024-01-05', dependsOn: [] }),
            makeTask({ id: 'b', title: 'B', startDate: '2024-01-06', endDate: '2024-01-10', dependsOn: ['a'] })
        ]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /gantt/i }));

        await waitFor(() => {
            expect(document.querySelector('polyline')).toBeInTheDocument();
        });
    });

    it('renders subtask rows in Gantt for subtasks with dates', async () => {
        preloadTasks([
            makeTask({
                id: 't1',
                title: 'Parent',
                startDate: '2024-01-01',
                endDate: '2024-01-10',
                subtasks: [
                    makeSubtask({
                        id: 's1',
                        parentId: 't1',
                        title: 'Sub Task',
                        startDate: '2024-01-02',
                        endDate: '2024-01-05'
                    })
                ]
            })
        ]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /gantt/i }));

        await waitFor(() => {
            // Gantt renders labels as SVG text
            const svgTexts = document.querySelectorAll('svg text');
            const labels = Array.from(svgTexts).map(t => t.textContent ?? '');
            expect(labels.some(l => l.includes('Sub Task'))).toBe(true);
        });
    });

    // ── Expand / collapse subtasks ────────────────────────────────────────

    it('shows subtasks when ▼ is clicked (expand)', async () => {
        preloadTasks([
            makeTask({
                id: 't1',
                title: 'Parent',
                subtasks: [makeSubtask({ id: 's1', parentId: 't1', title: 'Child Sub' })]
            })
        ]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByText('▼'));

        expect(screen.getByText('Child Sub')).toBeInTheDocument();
    });

    it('hides subtasks when ▲ is clicked (collapse)', async () => {
        preloadTasks([
            makeTask({
                id: 't1',
                title: 'Parent',
                subtasks: [makeSubtask({ id: 's1', parentId: 't1', title: 'Child Sub' })]
            })
        ]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByText('▼'));
        expect(screen.getByText('Child Sub')).toBeInTheDocument();

        await user.click(screen.getByText('▲'));
        expect(screen.queryByText('Child Sub')).not.toBeInTheDocument();
    });

    // ── Toggle subtask complete ───────────────────────────────────────────

    it('toggles subtask completion', async () => {
        preloadTasks([
            makeTask({
                id: 't1',
                title: 'Parent',
                subtasks: [makeSubtask({ id: 's1', parentId: 't1', title: 'Sub', completed: false })]
            })
        ]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByText('▼'));

        const subtaskCheckbox = screen.getAllByTitle('Toggle complete')[1]; // second toggle is subtask
        await user.click(subtaskCheckbox);

        await waitFor(() => {
            const subTitle = screen.getByText('Sub');
            expect(subTitle.className).toContain('line-through');
        });
    });

    // ── Subtask assignee / date display ───────────────────────────────────

    it('shows assignee icon and date range for subtask with those fields', async () => {
        preloadTasks([
            makeTask({
                id: 't1',
                title: 'Parent',
                subtasks: [
                    makeSubtask({
                        id: 's1',
                        parentId: 't1',
                        title: 'Rich Sub',
                        assignee: 'Alice',
                        startDate: '2024-02-01',
                        endDate: '2024-02-10'
                    })
                ]
            })
        ]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByText('▼'));

        expect(screen.getByText(/👤 Alice/)).toBeInTheDocument();
        expect(screen.getByText(/📅 2024-02-01 → 2024-02-10/)).toBeInTheDocument();
    });

    it('shows only start date (no arrow) when subtask has startDate but no endDate', async () => {
        preloadTasks([
            makeTask({
                id: 't1',
                title: 'Parent',
                subtasks: [makeSubtask({ id: 's1', parentId: 't1', title: 'DateSub', startDate: '2024-03-01' })]
            })
        ]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByText('▼'));

        const dateSpan = screen.getByText(/📅 2024-03-01/);
        expect(dateSpan).toBeInTheDocument();
        expect(dateSpan.textContent).not.toContain('→');
    });

    it('shows only start date (no arrow) when task has startDate but no endDate', () => {
        preloadTasks([makeTask({ id: 't1', title: 'Start Only Task', startDate: '2024-06-01' })]);
        render(<Tasks />, { wrapper: Wrapper });

        const dateSpan = screen.getByText(/📅 2024-06-01/);
        expect(dateSpan).toBeInTheDocument();
        expect(dateSpan.textContent).not.toContain('→');
    });

    // ── Subtask dependency checkboxes ─────────────────────────────────────

    it('shows "Depends on (subtasks)" section when adding a subtask and other subtasks exist', async () => {
        preloadTasks([
            makeTask({
                id: 't1',
                title: 'Parent',
                subtasks: [makeSubtask({ id: 's1', parentId: 't1', title: 'Existing Sub' })]
            })
        ]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ subtask/i }));

        expect(screen.getByText(/depends on \(subtasks\)/i)).toBeInTheDocument();
        expect(screen.getByText('Existing Sub')).toBeInTheDocument();
    });

    it('selecting a subtask dependency checkbox adds it to dependsOn', async () => {
        preloadTasks([
            makeTask({
                id: 't1',
                title: 'Parent',
                subtasks: [makeSubtask({ id: 's1', parentId: 't1', title: 'Dep Sub' })]
            })
        ]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ subtask/i }));

        await user.type(screen.getByPlaceholderText(/title \*/i), 'New Sub');

        // Check the dependency checkbox for the existing subtask
        const depCheckbox = screen.getByRole('checkbox', { name: /Dep Sub/i });
        await user.click(depCheckbox);
        expect(depCheckbox).toBeChecked();

        // Uncheck it again
        await user.click(depCheckbox);
        expect(depCheckbox).not.toBeChecked();
    });

    // ── Subtask form fields ───────────────────────────────────────────────

    it('filling all subtask form fields updates the form state', async () => {
        preloadTasks([makeTask({ id: 't1', title: 'Parent' })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ subtask/i }));

        await user.type(screen.getByPlaceholderText(/title \*/i), 'Full Sub');
        await user.type(screen.getByPlaceholderText(/^notes$/i), 'Some notes');

        // Use fireEvent for date inputs (userEvent has issues with type="date")
        const [startInput, endInput] = Array.from(
            document.querySelectorAll<HTMLInputElement>('input[type="date"]')
        );
        fireEvent.change(startInput, { target: { value: '2024-03-01' } });
        fireEvent.change(endInput, { target: { value: '2024-03-10' } });

        await user.type(screen.getByPlaceholderText(/assignee/i), 'Bob');

        // Toggle the completed checkbox in the modal
        const completedCheckbox = screen.getByRole('checkbox', { name: /completed/i });
        await user.click(completedCheckbox);
        expect(completedCheckbox).toBeChecked();

        await user.click(screen.getByRole('button', { name: /save/i }));

        // Expand subtask list and verify the new subtask was saved
        const expandBtn = await screen.findByText('▼');
        await user.click(expandBtn);

        await waitFor(() => {
            expect(screen.getByText('Full Sub')).toBeInTheDocument();
        });
    });

    it('Cancel closes the subtask modal without saving', async () => {
        preloadTasks([makeTask({ id: 't1', title: 'Parent' })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ subtask/i }));
        await user.type(screen.getByPlaceholderText(/title \*/i), 'Cancelled Sub');

        await user.click(screen.getByRole('button', { name: /cancel/i }));

        // Modal should be gone
        expect(screen.queryByPlaceholderText(/title \*/i)).not.toBeInTheDocument();
        // Subtask should NOT have been saved
        expect(screen.queryByText('Cancelled Sub')).not.toBeInTheDocument();
    });

    it('subtask form: changing startDate defaults endDate to startDate when endDate is blank', async () => {
        preloadTasks([makeTask({ id: 't1', title: 'Parent' })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ subtask/i }));

        const [startInput, endInput] = Array.from(
            document.querySelectorAll<HTMLInputElement>('input[type="date"]')
        );

        // Clear endDate first so the || fallback fires when startDate changes
        fireEvent.change(endInput, { target: { value: '' } });
        fireEvent.change(startInput, { target: { value: '2024-07-01' } });

        expect(endInput.value).toBe('2024-07-01');
    });

    it('Dup on a subtask with no optional fields opens modal with empty dates and assignee', async () => {
        preloadTasks([
            makeTask({
                id: 't1',
                title: 'Parent',
                subtasks: [
                    // makeSubtask without startDate/endDate/assignee → they're undefined
                    makeSubtask({ id: 's1', parentId: 't1', title: 'Bare Sub' })
                ]
            })
        ]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByText('▼'));
        await user.click(screen.getByRole('button', { name: /^dup$/i }));

        expect(screen.getByRole('heading', { name: /new subtask/i })).toBeInTheDocument();
        expect(screen.getByDisplayValue('Bare Sub')).toBeInTheDocument();

        // With no dates set, both date inputs should be empty
        const dateInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="date"]'));
        expect(dateInputs[0].value).toBe('');
        expect(dateInputs[1].value).toBe('');
    });

    // ── Default dates on new task modal ──────────────────────────────────

    it("pre-populates new task modal's startDate and endDate with today's date", async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));

        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add task/i }));

        const dateInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="date"]'));
        expect(dateInputs[0].value).toBe('2025-06-15');
        expect(dateInputs[1].value).toBe('2025-06-15');
    });

    // ── Duplicate subtask ─────────────────────────────────────────────────

    it('clicking Dup opens the subtask modal pre-filled with source subtask data and completed=false', async () => {
        preloadTasks([
            makeTask({
                id: 't1',
                title: 'Parent',
                subtasks: [
                    makeSubtask({
                        id: 's1',
                        parentId: 't1',
                        title: 'Original Sub',
                        notes: 'some notes',
                        startDate: '2024-05-01',
                        endDate: '2024-05-10',
                        assignee: 'Alice',
                        completed: true
                    })
                ]
            })
        ]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        // Expand subtasks so the Dup button is visible
        await user.click(screen.getByText('▼'));

        // Click the Dup button
        await user.click(screen.getByRole('button', { name: /^dup$/i }));

        // Modal should be open with the modal heading
        expect(screen.getByRole('heading', { name: /new subtask/i })).toBeInTheDocument();

        // Title pre-filled
        expect(screen.getByDisplayValue('Original Sub')).toBeInTheDocument();

        // Date inputs pre-filled from source subtask
        const dateInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="date"]'));
        expect(dateInputs[0].value).toBe('2024-05-01');
        expect(dateInputs[1].value).toBe('2024-05-10');

        // completed reset to false (checkbox unchecked)
        const completedCheckbox = screen.getByRole('checkbox', { name: /completed/i });
        expect(completedCheckbox).not.toBeChecked();
    });

    // ── Gantt dependency arrow null branch ────────────────────────────────

    it('does not render a dependency arrow when the dependency has no Gantt row (no dates)', async () => {
        // Task A has no dates → not a Gantt row. Task B has dates and depends on A.
        // The Gantt should render Task B's bar but return null for the dependency arrow to A.
        preloadTasks([
            makeTask({ id: 'a', title: 'No Dates Task', dependsOn: [] }),
            makeTask({ id: 'b', title: 'Dated Task', startDate: '2024-01-01', endDate: '2024-01-10', dependsOn: ['a'] })
        ]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /gantt/i }));

        await waitFor(() => {
            expect(document.querySelector('svg')).toBeInTheDocument();
        });

        // No polyline should be drawn because 'a' has no Gantt row
        expect(document.querySelector('polyline')).not.toBeInTheDocument();
    });

    // ── Subtask modal shows parent task name ──────────────────────────────

    it('subtask modal shows the parent task name', async () => {
        preloadTasks([makeTask({ id: 't1', title: 'Parent Task' })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ subtask/i }));

        expect(screen.getByTestId('subtask-modal-parent-title')).toHaveTextContent('Parent Task');
    });

    // ── New subtask inherits parent task assignee ─────────────────────────

    it('new subtask modal pre-fills assignee from the parent task', async () => {
        preloadTasks([makeTask({ id: 't1', title: 'Parent Task', assignee: 'Alice' })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ subtask/i }));

        expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
    });

    it('new subtask modal has empty assignee when parent task has none', async () => {
        preloadTasks([makeTask({ id: 't1', title: 'Parent Task' })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ subtask/i }));

        const assigneeInput = screen.getByPlaceholderText(/assignee/i);
        expect((assigneeInput as HTMLInputElement).value).toBe('');
    });

    // ── [Enter] in title field submits ────────────────────────────────────

    it('pressing Enter in task title input submits the form', async () => {
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add task/i }));
        const titleInput = screen.getByPlaceholderText(/title \*/i);
        await user.type(titleInput, 'Enter Task');
        fireEvent.keyDown(titleInput, { key: 'Enter' });

        await waitFor(() => {
            expect(screen.getByText('Enter Task')).toBeInTheDocument();
        });
    });

    it('pressing Enter in subtask title input submits the form', async () => {
        preloadTasks([makeTask({ id: 't1', title: 'Parent Task' })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ subtask/i }));
        const titleInput = screen.getByPlaceholderText(/title \*/i);
        await user.type(titleInput, 'Enter Subtask');
        fireEvent.keyDown(titleInput, { key: 'Enter' });

        const expandBtn = await screen.findByText('▼');
        await user.click(expandBtn);

        await waitFor(() => {
            expect(screen.getByText('Enter Subtask')).toBeInTheDocument();
        });
    });

    // ── [Shift]+[Enter] submits and reopens new modal ─────────────────────

    it('pressing Shift+Enter in task title saves and reopens a new task modal', async () => {
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add task/i }));
        const titleInput = screen.getByPlaceholderText(/title \*/i);
        await user.type(titleInput, 'First Task');
        fireEvent.keyDown(titleInput, { key: 'Enter', shiftKey: true });

        // Modal should still be open (new task form)
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /new task/i })).toBeInTheDocument();
        });

        // The first task should have been saved
        const newTitleInput = screen.getByPlaceholderText(/title \*/i);
        expect((newTitleInput as HTMLInputElement).value).toBe('');

        // Close and verify the task was saved
        await user.click(screen.getByRole('button', { name: /cancel/i }));
        expect(screen.getByText('First Task')).toBeInTheDocument();
    });

    it('pressing Shift+Enter in subtask title saves and reopens new subtask modal for same parent', async () => {
        preloadTasks([makeTask({ id: 't1', title: 'Parent Task' })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ subtask/i }));
        const titleInput = screen.getByPlaceholderText(/title \*/i);
        await user.type(titleInput, 'First Subtask');
        fireEvent.keyDown(titleInput, { key: 'Enter', shiftKey: true });

        // Modal should still be open (new subtask form for same parent)
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /new subtask/i })).toBeInTheDocument();
        });

        // Parent task name is still shown in the modal subtitle
        expect(screen.getByTestId('subtask-modal-parent-title')).toHaveTextContent('Parent Task');

        // The title field should be empty for the next subtask
        const newTitleInput = screen.getByPlaceholderText(/title \*/i);
        expect((newTitleInput as HTMLInputElement).value).toBe('');

        // Close and verify the subtask was saved
        await user.click(screen.getByRole('button', { name: /cancel/i }));

        const expandBtn = screen.getByText('▼');
        await user.click(expandBtn);
        expect(screen.getByText('First Subtask')).toBeInTheDocument();
    });

    it('task dep search resets after save-and-new (Shift+Enter)', async () => {
        preloadTasks([makeTask({ id: 't1', title: 'Existing Task' })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add task/i }));

        // Type a search term into the dep search field
        const depSearchInput = screen.getByPlaceholderText('Search tasks…');
        await user.type(depSearchInput, 'xyz');
        expect((depSearchInput as HTMLInputElement).value).toBe('xyz');

        // Save-and-new
        const titleInput = screen.getByPlaceholderText(/title \*/i);
        await user.type(titleInput, 'Task One');
        fireEvent.keyDown(titleInput, { key: 'Enter', shiftKey: true });

        // After save-and-new, dep search should be reset to empty
        await waitFor(() => {
            const newDepSearch = screen.getByPlaceholderText('Search tasks…');
            expect((newDepSearch as HTMLInputElement).value).toBe('');
        });
    });

    it('subtask dep search resets to parent title after save-and-new (Shift+Enter)', async () => {
        preloadTasks([
            makeTask({
                id: 't1',
                title: 'Parent Task',
                subtasks: [makeSubtask({ id: 's1', parentId: 't1', title: 'Existing Sub' })]
            })
        ]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ subtask/i }));

        // Dep search should default to parent task title
        const depSearchInput = screen.getByPlaceholderText('Search subtasks…');
        expect((depSearchInput as HTMLInputElement).value).toBe('Parent Task');

        // Clear dep search and type something else
        await user.clear(depSearchInput);
        await user.type(depSearchInput, 'xyz');
        expect((depSearchInput as HTMLInputElement).value).toBe('xyz');

        // Save-and-new
        const titleInput = screen.getByPlaceholderText(/title \*/i);
        await user.type(titleInput, 'Sub One');
        fireEvent.keyDown(titleInput, { key: 'Enter', shiftKey: true });

        // After save-and-new, dep search should reset to parent title
        await waitFor(() => {
            const newDepSearch = screen.getByPlaceholderText('Search subtasks…');
            expect((newDepSearch as HTMLInputElement).value).toBe('Parent Task');
        });
    });

    // ── IME/repeat guards on Enter shortcut ───────────────────────────────

    it('Enter with repeat=true in task title does not submit', async () => {
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add task/i }));
        const titleInput = screen.getByPlaceholderText(/title \*/i);
        await user.type(titleInput, 'Repeat Guard Task');
        fireEvent.keyDown(titleInput, { key: 'Enter', repeat: true });

        // Modal should still be open (not submitted)
        expect(screen.getByPlaceholderText(/title \*/i)).toBeInTheDocument();
    });

    it('Enter while isComposing in task title does not submit', async () => {
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add task/i }));
        const titleInput = screen.getByPlaceholderText(/title \*/i);
        await user.type(titleInput, 'IME Guard Task');
        fireEvent.keyDown(titleInput, new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true }));

        // Modal should still be open (not submitted)
        expect(screen.getByPlaceholderText(/title \*/i)).toBeInTheDocument();
    });

    it('Enter with repeat=true in subtask title does not submit', async () => {
        preloadTasks([makeTask({ id: 't1', title: 'Parent Task' })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ subtask/i }));
        const titleInput = screen.getByPlaceholderText(/title \*/i);
        await user.type(titleInput, 'Repeat Guard Sub');
        fireEvent.keyDown(titleInput, { key: 'Enter', repeat: true });

        // Modal should still be open (not submitted)
        expect(screen.getByPlaceholderText(/title \*/i)).toBeInTheDocument();
    });

    // ── Task dep-search filtering ─────────────────────────────────────────

    it('filters task dependency list as user types in search box', async () => {
        preloadTasks([
            makeTask({ id: 't1', title: 'Alpha Task' }),
            makeTask({ id: 't2', title: 'Beta Task' })
        ]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        // Open add-task modal (the two preloaded tasks appear as dep candidates)
        await user.click(screen.getByRole('button', { name: /\+ add task/i }));

        const depSearch = screen.getByPlaceholderText('Search tasks…');
        await user.type(depSearch, 'alpha');

        // Alpha Task dep-checkbox present; Beta Task dep-checkbox filtered out
        expect(screen.getByRole('checkbox', { name: /Alpha Task/i })).toBeInTheDocument();
        expect(screen.queryByRole('checkbox', { name: /Beta Task/i })).not.toBeInTheDocument();
    });

    it('shows "No tasks match your search" when task dep search has no results', async () => {
        preloadTasks([makeTask({ id: 't1', title: 'Existing Task' })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add task/i }));

        const depSearch = screen.getByPlaceholderText('Search tasks…');
        await user.type(depSearch, 'zzznomatch');

        expect(screen.getByText(/no tasks match your search/i)).toBeInTheDocument();
    });

    // ── Subtask dep-search filtering ──────────────────────────────────────

    it('subtask dep search defaults to parent task name and shows only siblings', async () => {
        preloadTasks([
            makeTask({
                id: 't1',
                title: 'First Group',
                subtasks: [makeSubtask({ id: 's1', parentId: 't1', title: 'Sibling Sub' })]
            }),
            makeTask({
                id: 't2',
                title: 'Second Group',
                subtasks: [makeSubtask({ id: 's2', parentId: 't2', title: 'Other Sub' })]
            })
        ]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        const subtaskButtons = screen.getAllByRole('button', { name: /\+ subtask/i });
        await user.click(subtaskButtons[0]);

        // Dep search pre-filled with parent task title
        const depSearch = screen.getByPlaceholderText('Search subtasks…');
        expect((depSearch as HTMLInputElement).value).toBe('First Group');

        // Only the sibling (parentTitle="First Group") is visible; the other-parent sub is not
        expect(screen.getByRole('checkbox', { name: /Sibling Sub/i })).toBeInTheDocument();
        expect(screen.queryByRole('checkbox', { name: /Other Sub/i })).not.toBeInTheDocument();
    });

    it('filters subtask dep list when user clears default and types new query', async () => {
        preloadTasks([
            makeTask({
                id: 't1',
                title: 'Parent',
                subtasks: [
                    makeSubtask({ id: 's1', parentId: 't1', title: 'Alpha Sub' }),
                    makeSubtask({ id: 's2', parentId: 't1', title: 'Beta Sub' })
                ]
            })
        ]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ subtask/i }));

        const depSearch = screen.getByPlaceholderText('Search subtasks…');
        await user.clear(depSearch);
        await user.type(depSearch, 'alpha');

        // Alpha Sub dep-checkbox present; Beta Sub dep-checkbox filtered out
        expect(screen.getByRole('checkbox', { name: /Alpha Sub/i })).toBeInTheDocument();
        expect(screen.queryByRole('checkbox', { name: /Beta Sub/i })).not.toBeInTheDocument();
    });

    it('shows "No subtasks match your search" when subtask dep search has no results', async () => {
        preloadTasks([
            makeTask({
                id: 't1',
                title: 'Parent',
                subtasks: [makeSubtask({ id: 's1', parentId: 't1', title: 'Existing Sub' })]
            })
        ]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ subtask/i }));

        const depSearch = screen.getByPlaceholderText('Search subtasks…');
        await user.clear(depSearch);
        await user.type(depSearch, 'zzznomatch');

        expect(screen.getByText(/no subtasks match your search/i)).toBeInTheDocument();
    });

    // ── Dependency / dependent-count badges ───────────────────────────────

    it('shows ⬆ N badge on a task with dependsOn', () => {
        preloadTasks([
            makeTask({ id: 'a', title: 'Task A', dependsOn: [] }),
            makeTask({ id: 'b', title: 'Task B', dependsOn: ['a'] })
        ]);
        render(<Tasks />, { wrapper: Wrapper });

        expect(screen.getByTitle('Depends on 1 task(s)')).toBeInTheDocument();
    });

    it('shows ⬇ N badge on a task that other tasks depend on', () => {
        preloadTasks([
            makeTask({ id: 'a', title: 'Task A', dependsOn: [] }),
            makeTask({ id: 'b', title: 'Task B', dependsOn: ['a'] })
        ]);
        render(<Tasks />, { wrapper: Wrapper });

        expect(screen.getByTitle('1 task(s) depend on this')).toBeInTheDocument();
    });

    it('shows ⬆ N badge on a subtask with dependsOn', async () => {
        preloadTasks([
            makeTask({
                id: 't1',
                title: 'Parent',
                subtasks: [
                    makeSubtask({ id: 's1', parentId: 't1', title: 'Sub A', dependsOn: [] }),
                    makeSubtask({ id: 's2', parentId: 't1', title: 'Sub B', dependsOn: ['s1'] })
                ]
            })
        ]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByText('▼'));

        expect(screen.getByTitle('Depends on 1 subtask(s)')).toBeInTheDocument();
    });

    it('shows ⬇ N badge on a subtask that other subtasks depend on', async () => {
        preloadTasks([
            makeTask({
                id: 't1',
                title: 'Parent',
                subtasks: [
                    makeSubtask({ id: 's1', parentId: 't1', title: 'Sub A', dependsOn: [] }),
                    makeSubtask({ id: 's2', parentId: 't1', title: 'Sub B', dependsOn: ['s1'] })
                ]
            })
        ]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByText('▼'));

        expect(screen.getByTitle('1 subtask(s) depend on this')).toBeInTheDocument();
    });

    it('task without dependsOn field shows no dep badge and no dep count badge', () => {
        // Preload a raw task that omits the dependsOn field entirely so the ?? fallback is exercised
        localStorage.setItem(
            'renovation-data',
            JSON.stringify({
                notes: [],
                tasks: [{ id: 't1', title: 'Bare Task', notes: '', completed: false, subtasks: [] }],
                expenses: [],
                calendarEvents: [],
                budget: 0
            })
        );
        render(<Tasks />, { wrapper: Wrapper });

        expect(screen.getByText('Bare Task')).toBeInTheDocument();
        expect(screen.queryByTitle(/depends on/i)).not.toBeInTheDocument();
        expect(screen.queryByTitle(/depend on this/i)).not.toBeInTheDocument();
    });

    // ── Empty-title feedback ──────────────────────────────────────────────

    it('clicking Save with empty title shows "Title is required." error', async () => {
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add task/i }));
        // Do NOT type a title
        await user.click(screen.getByRole('button', { name: /save/i }));

        expect(screen.getByText('Title is required.')).toBeInTheDocument();
    });

    it('typing in title after error clears the error message', async () => {
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add task/i }));
        await user.click(screen.getByRole('button', { name: /save/i }));

        // Error shown
        expect(screen.getByText('Title is required.')).toBeInTheDocument();

        // Start typing — error should disappear
        await user.type(screen.getByPlaceholderText(/title \*/i), 'A');
        expect(screen.queryByText('Title is required.')).not.toBeInTheDocument();
    });

    it('pressing Enter with empty task title shows "Title is required." error', async () => {
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add task/i }));
        const titleInput = screen.getByPlaceholderText(/title \*/i);
        fireEvent.keyDown(titleInput, { key: 'Enter' });

        expect(screen.getByText('Title is required.')).toBeInTheDocument();
    });

    it('pressing Shift+Enter with empty task title shows "Title is required." error', async () => {
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ add task/i }));
        const titleInput = screen.getByPlaceholderText(/title \*/i);
        fireEvent.keyDown(titleInput, { key: 'Enter', shiftKey: true });

        expect(screen.getByText('Title is required.')).toBeInTheDocument();
    });

    it('clicking Save with empty subtask title shows "Title is required." error', async () => {
        preloadTasks([makeTask({ id: 't1', title: 'Parent' })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ subtask/i }));
        await user.click(screen.getByRole('button', { name: /save/i }));

        expect(screen.getByText('Title is required.')).toBeInTheDocument();
    });

    it('pressing Enter with empty subtask title shows "Title is required." error', async () => {
        preloadTasks([makeTask({ id: 't1', title: 'Parent' })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ subtask/i }));
        const titleInput = screen.getByPlaceholderText(/title \*/i);
        fireEvent.keyDown(titleInput, { key: 'Enter' });

        expect(screen.getByText('Title is required.')).toBeInTheDocument();
    });

    // ── SubtaskModal dep-search edit mode ─────────────────────────────────

    it('pressing Shift+Enter with empty subtask title shows "Title is required." error', async () => {
        preloadTasks([makeTask({ id: 't1', title: 'Parent' })]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ subtask/i }));
        const titleInput = screen.getByPlaceholderText(/title \*/i);
        fireEvent.keyDown(titleInput, { key: 'Enter', shiftKey: true });

        expect(screen.getByText('Title is required.')).toBeInTheDocument();
    });

    it('editing a subtask starts with empty dep search (not parent task name)', async () => {
        preloadTasks([
            makeTask({
                id: 't1',
                title: 'Parent',
                subtasks: [
                    makeSubtask({ id: 's1', parentId: 't1', title: 'Existing Sub' }),
                    makeSubtask({ id: 's2', parentId: 't1', title: 'Another Sub' })
                ]
            })
        ]);
        const user = userEvent.setup();
        render(<Tasks />, { wrapper: Wrapper });

        await user.click(screen.getByText('▼'));
        const editButtons = screen.getAllByRole('button', { name: /^edit$/i });
        // edit the first subtask (has another sub as potential dependency)
        await user.click(editButtons[editButtons.length - 2]);

        // When editing, dep search should be empty (not pre-filled with parent title)
        const depSearch = screen.getByPlaceholderText('Search subtasks…');
        expect((depSearch as HTMLInputElement).value).toBe('');
    });
});
