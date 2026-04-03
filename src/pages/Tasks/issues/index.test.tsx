import type { TaskIssue } from './index';
import { issuePlugins } from './index';


/**
 * Tests for the defensive fallback branches inside each plugin's `key` and `renderFix`.
 *
 * In normal runtime, `key`/`renderFix` are only called after `handles` returns true,
 * so the wrong-type branches never fire through the popup. These tests call the
 * methods directly to guarantee coverage of those guard paths.
 */
describe('issuePlugins — defensive fallback branches', () => {
    const depOrderPlugin = issuePlugins[0];
    const subtaskFitPlugin = issuePlugins[1];

    const subtaskFitIssue: TaskIssue = {
        type: 'subtask-fit',
        subtaskId: 's1',
        subtaskTitle: 'Sub',
        subtaskStartDate: '2024-01-01',
        subtaskEndDate: '2024-01-10',
        parentId: 't1',
        parentTitle: 'Parent',
        parentStartDate: '2024-01-01',
        parentEndDate: '2024-01-10'
    };

    const depOrderIssue: TaskIssue = {
        type: 'dependency-order',
        dependentId: 'b',
        dependentTitle: 'Task B',
        dependentParentId: null,
        dependencyId: 'a',
        dependencyTitle: 'Task A',
        dependentStartDate: '2024-01-05',
        dependencyEndDate: '2024-01-10'
    };

    describe('dependency-order plugin', () => {
        it('key falls back to issue.type when given a non-dependency-order issue', () => {
            expect(depOrderPlugin.key(subtaskFitIssue)).toBe('subtask-fit');
        });

        it('renderFix returns null when given a non-dependency-order issue', () => {
            expect(depOrderPlugin.renderFix(subtaskFitIssue, vi.fn())).toBeNull();
        });
    });

    describe('subtask-fit plugin', () => {
        it('key falls back to issue.type when given a non-subtask-fit issue', () => {
            expect(subtaskFitPlugin.key(depOrderIssue)).toBe('dependency-order');
        });

        it('renderFix returns null when given a non-subtask-fit issue', () => {
            expect(subtaskFitPlugin.renderFix(depOrderIssue, vi.fn())).toBeNull();
        });
    });
});
