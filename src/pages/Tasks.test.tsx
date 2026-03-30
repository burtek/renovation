import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProvider } from '../contexts/AppContext';
import type { Subtask, Task } from '../types';

import Tasks from './Tasks';


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
});
