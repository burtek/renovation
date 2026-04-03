/**
 * Tests for the issue plugin registry (issues/index.tsx).
 *
 * These tests cover:
 *  - detectIssues() aggregating results from all plugins
 *  - Each plugin's key() function including the fallback branches
 *  - Each plugin's renderFix() function including the guard branches
 */

import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AppProvider } from '../../../contexts/AppContext';
import type { Task } from '../../../types';

import type { DependencyOrderIssue } from './dependencyOrder';
import type { TaskIssue } from './index';
import { detectIssues, issuePlugins } from './index';
import type { SubtaskFitIssue } from './subtaskFit';


function Wrapper({ children }: { children: ReactNode }) {
    return (
        <AppProvider>
            <MemoryRouter>{children}</MemoryRouter>
        </AppProvider>
    );
}

function makeTask(overrides: Partial<Task> = {}): Task {
    return {
        id: 't1',
        title: 'Task',
        notes: '',
        completed: false,
        subtasks: [],
        dependsOn: [],
        ...overrides
    };
}

const depOrderIssue: DependencyOrderIssue = {
    type: 'dependency-order',
    dependentId: 'b',
    dependentTitle: 'B',
    dependentParentId: null,
    dependencyId: 'a',
    dependencyTitle: 'A',
    dependentStartDate: '2024-01-05',
    dependencyEndDate: '2024-01-10'
};

const subtaskFitIssue: SubtaskFitIssue = {
    type: 'subtask-fit',
    subtaskId: 's1',
    subtaskTitle: 'Sub',
    subtaskStartDate: '2024-01-03',
    subtaskEndDate: '2024-01-12',
    parentId: 't1',
    parentTitle: 'Parent',
    parentStartDate: '2024-01-05',
    parentEndDate: '2024-01-10'
};

// ---------------------------------------------------------------------------
// detectIssues
// ---------------------------------------------------------------------------

describe('detectIssues', () => {
    it('returns an empty array when there are no tasks', () => {
        expect(detectIssues([])).toEqual([]);
    });

    it('returns an empty array when no task has issues', () => {
        const tasks = [
            makeTask({ id: 't1', startDate: '2024-01-01', endDate: '2024-01-10' }),
            makeTask({ id: 't2', startDate: '2024-01-11', endDate: '2024-01-20', dependsOn: ['t1'] })
        ];
        expect(detectIssues(tasks)).toHaveLength(0);
    });

    it('detects dependency-order violations', () => {
        const tasks = [
            makeTask({ id: 'a', endDate: '2024-01-10' }),
            makeTask({ id: 'b', startDate: '2024-01-05', dependsOn: ['a'] })
        ];
        const issues = detectIssues(tasks);
        expect(issues.some(i => i.type === 'dependency-order')).toBe(true);
    });

    it('detects subtask-fit violations', () => {
        const tasks = [
            makeTask({
                id: 't1',
                startDate: '2024-01-05',
                endDate: '2024-01-10',
                subtasks: [
                    {
                        id: 's1',
                        parentId: 't1',
                        title: 'Sub',
                        notes: '',
                        completed: false,
                        dependsOn: [],
                        startDate: '2024-01-03',
                        endDate: '2024-01-08'
                    }
                ]
            })
        ];
        const issues = detectIssues(tasks);
        expect(issues.some(i => i.type === 'subtask-fit')).toBe(true);
    });

    it('aggregates issues from both plugins', () => {
        const tasks = [
            makeTask({ id: 'a', endDate: '2024-01-10' }),
            makeTask({
                id: 'b',
                startDate: '2024-01-05',
                endDate: '2024-01-10',
                dependsOn: ['a'],
                subtasks: [
                    {
                        id: 's1',
                        parentId: 'b',
                        title: 'Sub',
                        notes: '',
                        completed: false,
                        dependsOn: [],
                        startDate: '2024-01-03',
                        endDate: '2024-01-08'
                    }
                ]
            })
        ];
        const issues = detectIssues(tasks);
        expect(issues.some(i => i.type === 'dependency-order')).toBe(true);
        expect(issues.some(i => i.type === 'subtask-fit')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Plugin registry: key() and renderFix()
// ---------------------------------------------------------------------------

describe('issuePlugins — dependency-order plugin', () => {
    const [depPlugin] = issuePlugins;

    it('key() returns the dep-<ids> key for a dependency-order issue', () => {
        expect(depPlugin.key(depOrderIssue)).toBe('dep-b-a');
    });

    it('key() falls back to issue.type when called with a non-dependency-order issue', () => {
        // Cross-type fallback: passes a subtask-fit issue to the dep-order plugin
        expect(depPlugin.key(subtaskFitIssue as unknown as TaskIssue)).toBe('subtask-fit');
    });

    it('handles() returns true only for dependency-order issues', () => {
        expect(depPlugin.handles(depOrderIssue)).toBe(true);
        expect(depPlugin.handles(subtaskFitIssue as unknown as TaskIssue)).toBe(false);
    });

    it('renderFix() returns null when called with a non-dependency-order issue', () => {
        const result = depPlugin.renderFix(subtaskFitIssue as unknown as TaskIssue, vi.fn());
        expect(result).toBeNull();
    });

    it('renderFix() renders a component for a valid dependency-order issue', () => {
        const { container } = render(
            <>{depPlugin.renderFix(depOrderIssue, vi.fn())}</>,
            { wrapper: Wrapper }
        );
        expect(container.firstChild).not.toBeNull();
    });
});

describe('issuePlugins — subtask-fit plugin', () => {
    const [, fitPlugin] = issuePlugins;

    it('key() returns the fit-<id> key for a subtask-fit issue', () => {
        expect(fitPlugin.key(subtaskFitIssue)).toBe('fit-s1');
    });

    it('key() falls back to issue.type when called with a non-subtask-fit issue', () => {
        // Cross-type fallback: passes a dependency-order issue to the fit plugin
        expect(fitPlugin.key(depOrderIssue as unknown as TaskIssue)).toBe('dependency-order');
    });

    it('handles() returns true only for subtask-fit issues', () => {
        expect(fitPlugin.handles(subtaskFitIssue)).toBe(true);
        expect(fitPlugin.handles(depOrderIssue as unknown as TaskIssue)).toBe(false);
    });

    it('renderFix() returns null when called with a non-subtask-fit issue', () => {
        const result = fitPlugin.renderFix(depOrderIssue as unknown as TaskIssue, vi.fn());
        expect(result).toBeNull();
    });

    it('renderFix() renders a component for a valid subtask-fit issue', () => {
        const { container } = render(
            <>{fitPlugin.renderFix(subtaskFitIssue, vi.fn())}</>,
            { wrapper: Wrapper }
        );
        expect(container.firstChild).not.toBeNull();
    });
});
