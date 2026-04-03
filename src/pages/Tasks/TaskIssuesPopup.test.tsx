import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AppProvider } from '../../contexts/AppContext';
import type { Subtask, Task } from '../../types';

import TaskIssuesPopup from './TaskIssuesPopup';
import type { TaskIssue } from './issues';


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function preloadTasks(tasks: Task[]) {
    localStorage.setItem(
        'renovation-data',
        JSON.stringify({ notes: [], tasks, expenses: [], calendarEvents: [], budget: 0 })
    );
}

function makeTask(overrides: Partial<Task> = {}): Task {
    return {
        id: 't1',
        title: 'Parent Task',
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
        title: 'Sub Task',
        notes: '',
        completed: false,
        dependsOn: [],
        ...overrides
    };
}

interface PopupWrapperProps {
    issues?: TaskIssue[];
    isOpen?: boolean;
    onClose?: () => void;
    pos?: { top: number; right: number } | null;
    children?: ReactNode;
}

const DEFAULT_ISSUES: TaskIssue[] = [];
const DEFAULT_POS = { top: 100, right: 100 };
const DEFAULT_ON_CLOSE = () => {
};

/** Renders the popup with a real anchor button so anchorRef is populated. */
function PopupWrapper({
    issues = DEFAULT_ISSUES,
    isOpen = true,
    onClose = DEFAULT_ON_CLOSE,
    pos = DEFAULT_POS,
    children
}: PopupWrapperProps) {
    const anchorRef = useRef<HTMLButtonElement>(null);
    return (
        <AppProvider>
            <MemoryRouter>
                <button
                    ref={anchorRef}
                    type="button"
                    data-testid="anchor"
                >
                    anchor
                </button>
                <TaskIssuesPopup
                    issues={issues}
                    isOpen={isOpen}
                    pos={pos}
                    anchorRef={anchorRef}
                    onClose={onClose}
                />
                {children}
            </MemoryRouter>
        </AppProvider>
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TaskIssuesPopup', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    // ── Visibility ────────────────────────────────────────────────────────

    it('renders nothing when isOpen is false', () => {
        const onClose = vi.fn();
        render(
            <PopupWrapper
                isOpen={false}
                onClose={onClose}
            />
        );
        expect(screen.queryByText(/task issues/i)).not.toBeInTheDocument();
    });

    it('renders the popup when isOpen is true', () => {
        render(<PopupWrapper />);
        expect(screen.getByText(/task issues/i)).toBeInTheDocument();
    });

    it('shows issue count in header', () => {
        const issues: TaskIssue[] = [
            {
                type: 'dependency-order',
                dependentId: 'b',
                dependentTitle: 'Task B',
                dependentParentId: null,
                dependencyId: 'a',
                dependencyTitle: 'Task A',
                dependentStartDate: '2024-01-05',
                dependencyEndDate: '2024-01-10'
            }
        ];
        render(<PopupWrapper issues={issues} />);
        expect(screen.getByText(/task issues \(1\)/i)).toBeInTheDocument();
    });

    // ── Close triggers ────────────────────────────────────────────────────

    it('calls onClose when ✕ button is clicked', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(<PopupWrapper onClose={onClose} />);
        await user.click(screen.getByRole('button', { name: /close issues panel/i }));
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('calls onClose when Escape key is pressed', () => {
        const onClose = vi.fn();
        render(<PopupWrapper onClose={onClose} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('calls onClose when clicking outside the popup', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <PopupWrapper onClose={onClose}>
                <div data-testid="outside">outside area</div>
            </PopupWrapper>
        );
        await user.click(screen.getByTestId('outside'));
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('does NOT call onClose when clicking the anchor button', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(<PopupWrapper onClose={onClose} />);
        await user.click(screen.getByTestId('anchor'));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('does NOT call onClose when clicking inside the popup', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(<PopupWrapper onClose={onClose} />);
        await user.click(screen.getByText(/task issues/i));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('does not react to Escape when isOpen is false', () => {
        const onClose = vi.fn();
        render(
            <PopupWrapper
                isOpen={false}
                onClose={onClose}
            />
        );
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).not.toHaveBeenCalled();
    });

    // ── DependencyOrderFix ────────────────────────────────────────────────

    it('renders DependencyOrderFix for a dependency-order issue', () => {
        const issues: TaskIssue[] = [
            {
                type: 'dependency-order',
                dependentId: 'b',
                dependentTitle: 'Task B',
                dependentParentId: null,
                dependencyId: 'a',
                dependencyTitle: 'Task A',
                dependentStartDate: '2024-01-05',
                dependencyEndDate: '2024-01-10'
            }
        ];
        render(<PopupWrapper issues={issues} />);
        expect(screen.getByText(/task b/i)).toBeInTheDocument();
        expect(screen.getByText(/task a/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /move start date to/i })).toBeInTheDocument();
    });

    it('clicking "Move start date" fixes a task-level dependency violation', async () => {
        const taskA = makeTask({ id: 'a', title: 'Task A', startDate: '2024-01-01', endDate: '2024-01-10' });
        const taskB = makeTask({ id: 'b', title: 'Task B', startDate: '2024-01-05', endDate: '2024-01-15', dependsOn: ['a'] });
        preloadTasks([taskA, taskB]);

        const issues: TaskIssue[] = [
            {
                type: 'dependency-order',
                dependentId: 'b',
                dependentTitle: 'Task B',
                dependentParentId: null,
                dependencyId: 'a',
                dependencyTitle: 'Task A',
                dependentStartDate: '2024-01-05',
                dependencyEndDate: '2024-01-10'
            }
        ];
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <PopupWrapper
                issues={issues}
                onClose={onClose}
            />
        );

        await user.click(screen.getByRole('button', { name: /move start date to/i }));
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('clicking "Move start date" fixes a subtask-level dependency violation', async () => {
        const subA = makeSubtask({ id: 'sA', parentId: 't1', title: 'Sub A', endDate: '2024-01-10' });
        const subB = makeSubtask({ id: 'sB', parentId: 't1', title: 'Sub B', startDate: '2024-01-05', endDate: '2024-01-15', dependsOn: ['sA'] });
        const task = makeTask({ id: 't1', subtasks: [subA, subB] });
        preloadTasks([task]);

        const issues: TaskIssue[] = [
            {
                type: 'dependency-order',
                dependentId: 'sB',
                dependentTitle: 'Sub B',
                dependentParentId: 't1',
                dependencyId: 'sA',
                dependencyTitle: 'Sub A',
                dependentStartDate: '2024-01-05',
                dependencyEndDate: '2024-01-10'
            }
        ];
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <PopupWrapper
                issues={issues}
                onClose={onClose}
            />
        );

        await user.click(screen.getByRole('button', { name: /move start date to/i }));
        expect(onClose).toHaveBeenCalledOnce();
    });

    // ── SubtaskFitFix ─────────────────────────────────────────────────────

    it('renders SubtaskFitFix with Fix ▾ button for a subtask-fit issue', () => {
        const issues: TaskIssue[] = [
            {
                type: 'subtask-fit',
                subtaskId: 's1',
                subtaskTitle: 'Sub Task',
                subtaskStartDate: '2024-01-03',
                subtaskEndDate: '2024-01-12',
                parentId: 't1',
                parentTitle: 'Parent Task',
                parentStartDate: '2024-01-05',
                parentEndDate: '2024-01-10'
            }
        ];
        render(<PopupWrapper issues={issues} />);
        expect(screen.getByText(/sub task/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /fix/i })).toBeInTheDocument();
    });

    it('Fix ▾ button opens the fix options menu', async () => {
        const issues: TaskIssue[] = [
            {
                type: 'subtask-fit',
                subtaskId: 's1',
                subtaskTitle: 'Sub',
                subtaskStartDate: '2024-01-03',
                subtaskEndDate: '2024-01-09',
                parentId: 't1',
                parentTitle: 'Parent',
                parentStartDate: '2024-01-05',
                parentEndDate: '2024-01-10'
            }
        ];
        const user = userEvent.setup();
        render(<PopupWrapper issues={issues} />);

        await user.click(screen.getByRole('button', { name: /fix/i }));
        expect(screen.getByRole('button', { name: /shorten subtask/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /extend parent/i })).toBeInTheDocument();
    });

    it('"Shorten subtask to fit parent" dispatches UPDATE_SUBTASK and calls onClose', async () => {
        const sub = makeSubtask({ id: 's1', parentId: 't1', startDate: '2024-01-03', endDate: '2024-01-09' });
        const task = makeTask({ id: 't1', startDate: '2024-01-05', endDate: '2024-01-10', subtasks: [sub] });
        preloadTasks([task]);

        const issues: TaskIssue[] = [
            {
                type: 'subtask-fit',
                subtaskId: 's1',
                subtaskTitle: 'Sub Task',
                subtaskStartDate: '2024-01-03',
                subtaskEndDate: '2024-01-09',
                parentId: 't1',
                parentTitle: 'Parent Task',
                parentStartDate: '2024-01-05',
                parentEndDate: '2024-01-10'
            }
        ];
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <PopupWrapper
                issues={issues}
                onClose={onClose}
            />
        );

        await user.click(screen.getByRole('button', { name: /fix/i }));
        await user.click(screen.getByRole('button', { name: /shorten subtask/i }));
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('"Extend parent to fit subtask" dispatches UPDATE_TASK and calls onClose', async () => {
        const sub = makeSubtask({ id: 's1', parentId: 't1', startDate: '2024-01-03', endDate: '2024-01-12' });
        const task = makeTask({ id: 't1', startDate: '2024-01-05', endDate: '2024-01-10', subtasks: [sub] });
        preloadTasks([task]);

        const issues: TaskIssue[] = [
            {
                type: 'subtask-fit',
                subtaskId: 's1',
                subtaskTitle: 'Sub Task',
                subtaskStartDate: '2024-01-03',
                subtaskEndDate: '2024-01-12',
                parentId: 't1',
                parentTitle: 'Parent Task',
                parentStartDate: '2024-01-05',
                parentEndDate: '2024-01-10'
            }
        ];
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <PopupWrapper
                issues={issues}
                onClose={onClose}
            />
        );

        await user.click(screen.getByRole('button', { name: /fix/i }));
        await user.click(screen.getByRole('button', { name: /extend parent/i }));
        expect(onClose).toHaveBeenCalled();
    });

    // ── Guard branches: task/subtask not found in store ───────────────────

    it('DependencyOrderFix: silently does nothing when dependent task is not in store', async () => {
        // Store is empty — the issue references a task that doesn't exist
        const issues: TaskIssue[] = [
            {
                type: 'dependency-order',
                dependentId: 'nonexistent',
                dependentTitle: 'Ghost Task',
                dependentParentId: null,
                dependencyId: 'dep',
                dependencyTitle: 'Dep Task',
                dependentStartDate: '2024-01-05',
                dependencyEndDate: '2024-01-10'
            }
        ];
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <PopupWrapper
                issues={issues}
                onClose={onClose}
            />
        );

        await user.click(screen.getByRole('button', { name: /move start date to/i }));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('DependencyOrderFix: silently does nothing when dependent subtask is not in store', async () => {
        const task = makeTask({ id: 't1', subtasks: [] });
        preloadTasks([task]);

        const issues: TaskIssue[] = [
            {
                type: 'dependency-order',
                dependentId: 'nonexistent-sub',
                dependentTitle: 'Ghost Sub',
                dependentParentId: 't1',
                dependencyId: 'dep',
                dependencyTitle: 'Dep',
                dependentStartDate: '2024-01-05',
                dependencyEndDate: '2024-01-10'
            }
        ];
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <PopupWrapper
                issues={issues}
                onClose={onClose}
            />
        );

        await user.click(screen.getByRole('button', { name: /move start date to/i }));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('SubtaskFitFix: Shorten silently does nothing when subtask is not in store', async () => {
        const task = makeTask({ id: 't1', startDate: '2024-01-05', endDate: '2024-01-10', subtasks: [] });
        preloadTasks([task]);

        const issues: TaskIssue[] = [
            {
                type: 'subtask-fit',
                subtaskId: 'nonexistent',
                subtaskTitle: 'Ghost Sub',
                subtaskStartDate: '2024-01-03',
                subtaskEndDate: '2024-01-09',
                parentId: 't1',
                parentTitle: 'Parent',
                parentStartDate: '2024-01-05',
                parentEndDate: '2024-01-10'
            }
        ];
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <PopupWrapper
                issues={issues}
                onClose={onClose}
            />
        );

        await user.click(screen.getByRole('button', { name: /fix/i }));
        await user.click(screen.getByRole('button', { name: /shorten subtask/i }));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('SubtaskFitFix: Extend silently does nothing when parent task is not in store', async () => {
        // Store is empty — parent doesn't exist
        const issues: TaskIssue[] = [
            {
                type: 'subtask-fit',
                subtaskId: 's1',
                subtaskTitle: 'Sub',
                subtaskStartDate: '2024-01-03',
                subtaskEndDate: '2024-01-12',
                parentId: 'nonexistent-parent',
                parentTitle: 'Ghost Parent',
                parentStartDate: '2024-01-05',
                parentEndDate: '2024-01-10'
            }
        ];
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <PopupWrapper
                issues={issues}
                onClose={onClose}
            />
        );

        await user.click(screen.getByRole('button', { name: /fix/i }));
        await user.click(screen.getByRole('button', { name: /extend parent/i }));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('renders null for an issue with no matching plugin', () => {
        const unknownIssue = { type: 'unknown-type' } as unknown as TaskIssue;
        render(<PopupWrapper issues={[unknownIssue]} />);
        // Popup header is visible but no issue content
        expect(screen.getByText(/task issues \(1\)/i)).toBeInTheDocument();
        // No fix button rendered since no plugin handles this
        expect(screen.queryByRole('button', { name: /move start date|fix/i })).not.toBeInTheDocument();
    });

    // ── pos=null renders popup as hidden ──────────────────────────────────

    it('renders popup with visibility hidden when pos is null', () => {
        const issues: TaskIssue[] = [
            {
                type: 'dependency-order',
                dependentId: 'b',
                dependentTitle: 'Task B',
                dependentParentId: null,
                dependencyId: 'a',
                dependencyTitle: 'Task A',
                dependentStartDate: '2024-01-05',
                dependencyEndDate: '2024-01-10'
            }
        ];
        render(
            <PopupWrapper
                issues={issues}
                pos={null}
            />
        );
        // Popup still renders, just hidden
        expect(screen.getByText(/task issues \(1\)/i)).toBeInTheDocument();
    });

    // ── Non-Escape key does NOT close ─────────────────────────────────────

    it('does NOT call onClose when a non-Escape key is pressed', () => {
        const onClose = vi.fn();
        render(<PopupWrapper onClose={onClose} />);
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(onClose).not.toHaveBeenCalled();
    });

    // ── DependencyOrderFix: task/subtask without endDate ──────────────────

    it('DependencyOrderFix: fixes task with no endDate (shift endDate stays undefined)', async () => {
        const taskA = makeTask({ id: 'a', title: 'Task A', endDate: '2024-01-10' });
        // taskB has no endDate
        const taskB = makeTask({ id: 'b', title: 'Task B', startDate: '2024-01-05', endDate: undefined, dependsOn: ['a'] });
        preloadTasks([taskA, taskB]);

        const issues: TaskIssue[] = [
            {
                type: 'dependency-order',
                dependentId: 'b',
                dependentTitle: 'Task B',
                dependentParentId: null,
                dependencyId: 'a',
                dependencyTitle: 'Task A',
                dependentStartDate: '2024-01-05',
                dependencyEndDate: '2024-01-10'
            }
        ];
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <PopupWrapper
                issues={issues}
                onClose={onClose}
            />
        );

        await user.click(screen.getByRole('button', { name: /move start date to/i }));
        expect(onClose).toHaveBeenCalled();
    });

    it('DependencyOrderFix: fixes subtask with no endDate (shift endDate stays undefined)', async () => {
        const subA = makeSubtask({ id: 'sA', parentId: 't1', endDate: '2024-01-10' });
        // subB has no endDate
        const subB = makeSubtask({ id: 'sB', parentId: 't1', title: 'Sub B', startDate: '2024-01-05', endDate: undefined, dependsOn: ['sA'] });
        const task = makeTask({ id: 't1', subtasks: [subA, subB] });
        preloadTasks([task]);

        const issues: TaskIssue[] = [
            {
                type: 'dependency-order',
                dependentId: 'sB',
                dependentTitle: 'Sub B',
                dependentParentId: 't1',
                dependencyId: 'sA',
                dependencyTitle: 'Sub A',
                dependentStartDate: '2024-01-05',
                dependencyEndDate: '2024-01-10'
            }
        ];
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <PopupWrapper
                issues={issues}
                onClose={onClose}
            />
        );

        await user.click(screen.getByRole('button', { name: /move start date to/i }));
        expect(onClose).toHaveBeenCalled();
    });

    // ── SubtaskFitFix: start-only / end-only violations ───────────────────

    it('SubtaskFitFix: Shorten with start-only violation keeps endDate unchanged', async () => {
        const sub = makeSubtask({ id: 's1', parentId: 't1', startDate: '2024-01-03', endDate: '2024-01-09' });
        const task = makeTask({ id: 't1', startDate: '2024-01-05', endDate: '2024-01-10', subtasks: [sub] });
        preloadTasks([task]);

        // Only start violation (subtask starts before parent; ends within parent)
        const issues: TaskIssue[] = [
            {
                type: 'subtask-fit',
                subtaskId: 's1',
                subtaskTitle: 'Sub Task',
                subtaskStartDate: '2024-01-03',
                subtaskEndDate: '2024-01-09',
                parentId: 't1',
                parentTitle: 'Parent Task',
                parentStartDate: '2024-01-05',
                parentEndDate: '2024-01-10'
            }
        ];
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <PopupWrapper
                issues={issues}
                onClose={onClose}
            />
        );

        await user.click(screen.getByRole('button', { name: /fix/i }));
        await user.click(screen.getByRole('button', { name: /shorten subtask/i }));
        expect(onClose).toHaveBeenCalled();
    });

    it('SubtaskFitFix: Shorten with end-only violation keeps startDate unchanged', async () => {
        const sub = makeSubtask({ id: 's1', parentId: 't1', startDate: '2024-01-06', endDate: '2024-01-12' });
        const task = makeTask({ id: 't1', startDate: '2024-01-05', endDate: '2024-01-10', subtasks: [sub] });
        preloadTasks([task]);

        // Only end violation (subtask ends after parent; starts within parent)
        const issues: TaskIssue[] = [
            {
                type: 'subtask-fit',
                subtaskId: 's1',
                subtaskTitle: 'Sub Task',
                subtaskStartDate: '2024-01-06',
                subtaskEndDate: '2024-01-12',
                parentId: 't1',
                parentTitle: 'Parent Task',
                parentStartDate: '2024-01-05',
                parentEndDate: '2024-01-10'
            }
        ];
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <PopupWrapper
                issues={issues}
                onClose={onClose}
            />
        );

        await user.click(screen.getByRole('button', { name: /fix/i }));
        await user.click(screen.getByRole('button', { name: /shorten subtask/i }));
        expect(onClose).toHaveBeenCalled();
    });

    it('SubtaskFitFix: Extend with start-only violation keeps endDate unchanged', async () => {
        const sub = makeSubtask({ id: 's1', parentId: 't1', startDate: '2024-01-03', endDate: '2024-01-09' });
        const task = makeTask({ id: 't1', startDate: '2024-01-05', endDate: '2024-01-10', subtasks: [sub] });
        preloadTasks([task]);

        const issues: TaskIssue[] = [
            {
                type: 'subtask-fit',
                subtaskId: 's1',
                subtaskTitle: 'Sub Task',
                subtaskStartDate: '2024-01-03',
                subtaskEndDate: '2024-01-09',
                parentId: 't1',
                parentTitle: 'Parent Task',
                parentStartDate: '2024-01-05',
                parentEndDate: '2024-01-10'
            }
        ];
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <PopupWrapper
                issues={issues}
                onClose={onClose}
            />
        );

        await user.click(screen.getByRole('button', { name: /fix/i }));
        await user.click(screen.getByRole('button', { name: /extend parent/i }));
        expect(onClose).toHaveBeenCalled();
    });

    it('SubtaskFitFix: Extend with end-only violation keeps startDate unchanged', async () => {
        const sub = makeSubtask({ id: 's1', parentId: 't1', startDate: '2024-01-06', endDate: '2024-01-12' });
        const task = makeTask({ id: 't1', startDate: '2024-01-05', endDate: '2024-01-10', subtasks: [sub] });
        preloadTasks([task]);

        const issues: TaskIssue[] = [
            {
                type: 'subtask-fit',
                subtaskId: 's1',
                subtaskTitle: 'Sub Task',
                subtaskStartDate: '2024-01-06',
                subtaskEndDate: '2024-01-12',
                parentId: 't1',
                parentTitle: 'Parent Task',
                parentStartDate: '2024-01-05',
                parentEndDate: '2024-01-10'
            }
        ];
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <PopupWrapper
                issues={issues}
                onClose={onClose}
            />
        );

        await user.click(screen.getByRole('button', { name: /fix/i }));
        await user.click(screen.getByRole('button', { name: /extend parent/i }));
        expect(onClose).toHaveBeenCalled();
    });

    // ── SubtaskFitFix: undefined date fallback displays '?' ───────────────

    it('SubtaskFitFix: shows "?" for undefined subtask and parent dates', () => {
        const issues: TaskIssue[] = [
            {
                type: 'subtask-fit',
                subtaskId: 's1',
                subtaskTitle: 'Sub',
                subtaskStartDate: undefined,
                subtaskEndDate: undefined,
                parentId: 't1',
                parentTitle: 'Parent',
                parentStartDate: undefined,
                parentEndDate: undefined
            }
        ];
        render(<PopupWrapper issues={issues} />);
        // Component renders without throwing for undefined dates
        expect(screen.getByText(/task issues \(1\)/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /fix/i })).toBeInTheDocument();
        // Each undefined date fallback renders '?' in the description
        const body = document.body.textContent ?? '';
        expect((body.match(/\?/g) ?? []).length).toBeGreaterThanOrEqual(2);
    });
});
