import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProvider } from '../../contexts/AppContext';

import TaskIssuesPopup from './TaskIssuesPopup';
import type { DependencyOrderIssue, SubtaskFitIssue } from './taskIssues';


function Wrapper({ children }: { children: ReactNode }) {
    return (
        <AppProvider>
            <MemoryRouter>
                {children}
            </MemoryRouter>
        </AppProvider>
    );
}

const depIssueTopLevel: DependencyOrderIssue = {
    type: 'dependency-order',
    dependentId: 'gone-task',
    dependentTitle: 'Gone Task',
    dependentParentId: null,
    dependencyId: 'dep-task',
    dependencyTitle: 'Dep Task',
    dependentStartDate: '2024-01-05',
    dependencyEndDate: '2024-01-10'
};

const depIssueSubtask: DependencyOrderIssue = {
    type: 'dependency-order',
    dependentId: 'gone-sub',
    dependentTitle: 'Gone Sub',
    dependentParentId: 'gone-parent',
    dependencyId: 'dep-sub',
    dependencyTitle: 'Dep Sub',
    dependentStartDate: '2024-01-05',
    dependencyEndDate: '2024-01-10'
};

const fitIssue: SubtaskFitIssue = {
    type: 'subtask-fit',
    subtaskId: 'gone-sub',
    subtaskTitle: 'Gone Sub',
    subtaskStartDate: '2024-01-01',
    subtaskEndDate: '2024-01-20',
    parentId: 'gone-parent',
    parentTitle: 'Gone Parent',
    parentStartDate: '2024-01-03',
    parentEndDate: '2024-01-10'
};

/** Issue where all date fields are undefined → exercises the ?? '?' fallbacks */
const fitIssueUndatedDates: SubtaskFitIssue = {
    type: 'subtask-fit',
    subtaskId: 'gone-sub',
    subtaskTitle: 'Gone Sub',
    subtaskStartDate: undefined,
    subtaskEndDate: undefined,
    parentId: 'gone-parent',
    parentTitle: 'Gone Parent',
    parentStartDate: undefined,
    parentEndDate: undefined
};

describe('TaskIssuesPopup', () => {
    beforeEach(() => {
        localStorage.clear();
    });
    afterEach(() => {
        localStorage.clear();
    });

    it('renders nothing when isOpen is false', () => {
        render(
            <TaskIssuesPopup
                issues={[depIssueTopLevel]}
                isOpen={false}
                onClose={vi.fn()}
            />,
            { wrapper: Wrapper }
        );
        expect(screen.queryByText(/task issues/i)).not.toBeInTheDocument();
    });

    it('keydown while popup is closed does not call onClose (listener not registered)', async () => {
        // When isOpen=false the keydown listener is not registered at all
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <TaskIssuesPopup
                issues={[depIssueTopLevel]}
                isOpen={false}
                onClose={onClose}
            />,
            { wrapper: Wrapper }
        );
        await user.keyboard('{Escape}');
        expect(onClose).not.toHaveBeenCalled();
    });

    it('keydown with non-Escape key while popup is open does not call onClose', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <TaskIssuesPopup
                issues={[depIssueTopLevel]}
                isOpen
                onClose={onClose}
            />,
            { wrapper: Wrapper }
        );
        await user.keyboard('{Enter}');
        expect(onClose).not.toHaveBeenCalled();
    });

    it('renders subtask-fit issue with undefined dates using ? placeholder', () => {
        render(
            <TaskIssuesPopup
                issues={[fitIssueUndatedDates]}
                isOpen
                onClose={vi.fn()}
            />,
            { wrapper: Wrapper }
        );
        // All four ?? '?' fallbacks should appear as '?' in the rendered text
        expect(document.body.textContent).toContain('? – ?');
    });

    it('guard: fix dependency-order for top-level task that no longer exists in store', async () => {
        // The store is empty (AppProvider starts with no tasks).
        // Clicking fix should hit the !task guard and return silently — no crash.
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <TaskIssuesPopup
                issues={[depIssueTopLevel]}
                isOpen
                onClose={onClose}
            />,
            { wrapper: Wrapper }
        );

        await user.click(screen.getByRole('button', { name: /move start date to/i }));
        // onClose is NOT called because the guard returns early
        expect(onClose).not.toHaveBeenCalled();
    });

    it('guard: fix dependency-order for subtask whose parent no longer exists in store', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <TaskIssuesPopup
                issues={[depIssueSubtask]}
                isOpen
                onClose={onClose}
            />,
            { wrapper: Wrapper }
        );

        await user.click(screen.getByRole('button', { name: /move start date to/i }));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('guard: shorten subtask when parent task no longer exists in store', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <TaskIssuesPopup
                issues={[fitIssue]}
                isOpen
                onClose={onClose}
            />,
            { wrapper: Wrapper }
        );

        await user.click(screen.getByRole('button', { name: /fix/i }));
        await user.click(screen.getByRole('button', { name: /shorten subtask to fit parent/i }));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('guard: extend parent when parent task no longer exists in store', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <TaskIssuesPopup
                issues={[fitIssue]}
                isOpen
                onClose={onClose}
            />,
            { wrapper: Wrapper }
        );

        await user.click(screen.getByRole('button', { name: /fix/i }));
        await user.click(screen.getByRole('button', { name: /extend parent to fit subtask/i }));
        expect(onClose).not.toHaveBeenCalled();
    });
});
