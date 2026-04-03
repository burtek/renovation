import type { Task } from '../../../types';

import { detectDependencyOrderIssues } from './dependencyOrder';


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

describe('detectDependencyOrderIssues', () => {
    it('returns empty array for empty task list', () => {
        expect(detectDependencyOrderIssues([])).toEqual([]);
    });

    it('returns empty array when no tasks have dependencies', () => {
        const tasks = [
            makeTask({ id: 'a', startDate: '2024-01-01', endDate: '2024-01-10' }),
            makeTask({ id: 'b', startDate: '2024-01-11', endDate: '2024-01-20' })
        ];
        expect(detectDependencyOrderIssues(tasks)).toEqual([]);
    });

    it('detects task-level violation: dependent starts before dependency ends', () => {
        const tasks = [
            makeTask({ id: 'a', title: 'Task A', endDate: '2024-01-10', dependsOn: [] }),
            makeTask({ id: 'b', title: 'Task B', startDate: '2024-01-05', dependsOn: ['a'] })
        ];
        const issues = detectDependencyOrderIssues(tasks);
        expect(issues).toHaveLength(1);
        expect(issues[0]).toMatchObject({
            type: 'dependency-order',
            dependentId: 'b',
            dependentTitle: 'Task B',
            dependentParentId: null,
            dependencyId: 'a',
            dependencyTitle: 'Task A',
            dependentStartDate: '2024-01-05',
            dependencyEndDate: '2024-01-10'
        });
    });

    it('does not flag task when it starts exactly on dependency end date', () => {
        const tasks = [
            makeTask({ id: 'a', endDate: '2024-01-10' }),
            makeTask({ id: 'b', startDate: '2024-01-10', dependsOn: ['a'] })
        ];
        expect(detectDependencyOrderIssues(tasks)).toEqual([]);
    });

    it('does not flag task when it starts after dependency end date', () => {
        const tasks = [
            makeTask({ id: 'a', endDate: '2024-01-10' }),
            makeTask({ id: 'b', startDate: '2024-01-11', dependsOn: ['a'] })
        ];
        expect(detectDependencyOrderIssues(tasks)).toEqual([]);
    });

    it('skips task-level check when dependent task has no startDate', () => {
        const tasks = [
            makeTask({ id: 'a', endDate: '2024-01-10' }),
            makeTask({ id: 'b', startDate: undefined, dependsOn: ['a'] })
        ];
        expect(detectDependencyOrderIssues(tasks)).toEqual([]);
    });

    it('skips task-level check when dependency has no endDate', () => {
        const tasks = [
            makeTask({ id: 'a', endDate: undefined }),
            makeTask({ id: 'b', startDate: '2024-01-05', dependsOn: ['a'] })
        ];
        expect(detectDependencyOrderIssues(tasks)).toEqual([]);
    });

    it('skips task when dependsOn is undefined', () => {
        const tasks = [
            makeTask({ id: 'a', endDate: '2024-01-10' }),
            makeTask({ id: 'b', startDate: '2024-01-05', dependsOn: undefined })
        ];
        expect(detectDependencyOrderIssues(tasks)).toEqual([]);
    });

    it('detects subtask-level violation: subtask starts before sibling dependency ends', () => {
        const tasks = [
            makeTask({
                id: 'parent',
                title: 'Parent',
                subtasks: [
                    {
                        id: 'sA',
                        parentId: 'parent',
                        title: 'Sub A',
                        notes: '',
                        completed: false,
                        endDate: '2024-01-10',
                        dependsOn: []
                    },
                    {
                        id: 'sB',
                        parentId: 'parent',
                        title: 'Sub B',
                        notes: '',
                        completed: false,
                        startDate: '2024-01-05',
                        dependsOn: ['sA']
                    }
                ]
            })
        ];
        const issues = detectDependencyOrderIssues(tasks);
        expect(issues).toHaveLength(1);
        expect(issues[0]).toMatchObject({
            type: 'dependency-order',
            dependentId: 'sB',
            dependentTitle: 'Sub B',
            dependentParentId: 'parent',
            dependencyId: 'sA',
            dependencyTitle: 'Sub A',
            dependentStartDate: '2024-01-05',
            dependencyEndDate: '2024-01-10'
        });
    });

    it('skips subtask-level check when subtask has no startDate', () => {
        const tasks = [
            makeTask({
                id: 'parent',
                subtasks: [
                    {
                        id: 'sA',
                        parentId: 'parent',
                        title: 'A',
                        notes: '',
                        completed: false,
                        endDate: '2024-01-10',
                        dependsOn: []
                    },
                    {
                        id: 'sB',
                        parentId: 'parent',
                        title: 'B',
                        notes: '',
                        completed: false,
                        startDate: undefined,
                        dependsOn: ['sA']
                    }
                ]
            })
        ];
        expect(detectDependencyOrderIssues(tasks)).toEqual([]);
    });

    it('skips subtask-level check when subtask dependency has no endDate', () => {
        const tasks = [
            makeTask({
                id: 'parent',
                subtasks: [
                    {
                        id: 'sA',
                        parentId: 'parent',
                        title: 'A',
                        notes: '',
                        completed: false,
                        endDate: undefined,
                        dependsOn: []
                    },
                    {
                        id: 'sB',
                        parentId: 'parent',
                        title: 'B',
                        notes: '',
                        completed: false,
                        startDate: '2024-01-05',
                        dependsOn: ['sA']
                    }
                ]
            })
        ];
        expect(detectDependencyOrderIssues(tasks)).toEqual([]);
    });

    it('returns multiple issues when multiple violations exist', () => {
        const tasks = [
            makeTask({ id: 'a', title: 'A', endDate: '2024-01-10', dependsOn: [] }),
            makeTask({ id: 'b', title: 'B', startDate: '2024-01-05', dependsOn: ['a'] }),
            makeTask({ id: 'c', title: 'C', startDate: '2024-01-03', dependsOn: ['a'] })
        ];
        expect(detectDependencyOrderIssues(tasks)).toHaveLength(2);
    });
});
