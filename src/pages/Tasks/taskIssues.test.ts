import { describe, expect, it } from 'vitest';

import type { Subtask, Task } from '../../types';

import { detectIssues } from './taskIssues';


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

function makeSubtask(overrides: Partial<Subtask> = {}): Subtask {
    return {
        id: 's1',
        parentId: 't1',
        title: 'Subtask',
        notes: '',
        completed: false,
        ...overrides
    };
}

describe('detectIssues', () => {
    it('returns no issues for an empty task list', () => {
        expect(detectIssues([])).toEqual([]);
    });

    it('returns no issues when tasks have no dependencies or subtasks', () => {
        const tasks = [makeTask({ id: 't1', startDate: '2024-01-01', endDate: '2024-01-10' })];
        expect(detectIssues(tasks)).toEqual([]);
    });

    // ── Issue 1a: task-level dependency order ─────────────────────────────

    it('detects dependency-order issue when task starts before dependency ends', () => {
        const tasks = [
            makeTask({ id: 'a', title: 'A', startDate: '2024-01-01', endDate: '2024-01-10' }),
            makeTask({ id: 'b', title: 'B', startDate: '2024-01-05', endDate: '2024-01-15', dependsOn: ['a'] })
        ];
        const issues = detectIssues(tasks);
        expect(issues).toHaveLength(1);
        expect(issues[0]).toMatchObject({
            type: 'dependency-order',
            dependentId: 'b',
            dependencyId: 'a',
            dependentParentId: null,
            dependentStartDate: '2024-01-05',
            dependencyEndDate: '2024-01-10'
        });
    });

    it('does NOT flag dependency-order when task starts on/after dependency end', () => {
        const tasks = [
            makeTask({ id: 'a', title: 'A', startDate: '2024-01-01', endDate: '2024-01-10' }),
            makeTask({ id: 'b', title: 'B', startDate: '2024-01-10', endDate: '2024-01-20', dependsOn: ['a'] })
        ];
        expect(detectIssues(tasks)).toEqual([]);
    });

    it('skips task dependency check when task has no startDate', () => {
        const tasks = [
            makeTask({ id: 'a', endDate: '2024-01-10' }),
            makeTask({ id: 'b', dependsOn: ['a'] })
        ];
        expect(detectIssues(tasks)).toEqual([]);
    });

    it('skips task dependency check when dependency has no endDate', () => {
        const tasks = [
            makeTask({ id: 'a', startDate: '2024-01-01' }),
            makeTask({ id: 'b', startDate: '2024-01-01', dependsOn: ['a'] })
        ];
        expect(detectIssues(tasks)).toEqual([]);
    });

    // ── Issue 1b: subtask-level dependency order ──────────────────────────

    it('detects dependency-order issue when subtask starts before its dependency ends', () => {
        const subA = makeSubtask({ id: 'sA', parentId: 't1', title: 'Sub A', startDate: '2024-01-01', endDate: '2024-01-10' });
        const subB = makeSubtask({ id: 'sB', parentId: 't1', title: 'Sub B', startDate: '2024-01-05', endDate: '2024-01-15', dependsOn: ['sA'] });
        const tasks = [makeTask({ id: 't1', subtasks: [subA, subB] })];
        const issues = detectIssues(tasks);
        expect(issues).toHaveLength(1);
        expect(issues[0]).toMatchObject({
            type: 'dependency-order',
            dependentId: 'sB',
            dependencyId: 'sA',
            dependentParentId: 't1',
            dependentStartDate: '2024-01-05',
            dependencyEndDate: '2024-01-10'
        });
    });

    it('uses dep subtask title when its parent task is found', () => {
        const subA = makeSubtask({ id: 'sA', parentId: 't1', title: 'First Sub', startDate: '2024-01-01', endDate: '2024-01-10' });
        const subB = makeSubtask({ id: 'sB', parentId: 't1', title: 'Second Sub', startDate: '2024-01-05', endDate: '2024-01-15', dependsOn: ['sA'] });
        const tasks = [makeTask({ id: 't1', subtasks: [subA, subB] })];
        const [issue] = detectIssues(tasks);
        expect((issue as { dependencyTitle: string }).dependencyTitle).toBe('First Sub');
    });

    it('skips subtask dependency check when dependency subtask is not tracked (not in endMap)', () => {
        // sB depends on 'unknown-id' which is not in any subtask list,
        // so it won't be in subtaskEndMap → depEnd is undefined → early return (no issue)
        const subB = makeSubtask({
            id: 'sB',
            parentId: 't1',
            title: 'Sub B',
            startDate: '2024-01-05',
            endDate: '2024-01-15',
            dependsOn: ['unknown-id']
        });
        const tasks = [makeTask({ id: 't1', subtasks: [subB] })];
        expect(detectIssues(tasks)).toEqual([]);
    });

    it('skips subtask dependency check when subtask has no endDate (depEnd is undefined)', () => {
        // subA has no endDate so it won't be in subtaskEndMap
        const subA = makeSubtask({ id: 'sA', parentId: 't1', startDate: '2024-01-01' }); // no endDate
        const subB = makeSubtask({ id: 'sB', parentId: 't1', startDate: '2024-01-05', dependsOn: ['sA'] });
        const tasks = [makeTask({ id: 't1', subtasks: [subA, subB] })];
        expect(detectIssues(tasks)).toEqual([]);
    });

    it('skips subtask when it has no startDate', () => {
        const subA = makeSubtask({ id: 'sA', parentId: 't1', endDate: '2024-01-10' });
        const subB = makeSubtask({ id: 'sB', parentId: 't1', dependsOn: ['sA'] }); // no startDate
        const tasks = [makeTask({ id: 't1', subtasks: [subA, subB] })];
        expect(detectIssues(tasks)).toEqual([]);
    });

    // ── Issue 2: subtask-fit ──────────────────────────────────────────────

    it('detects subtask-fit issue when subtask ends after parent ends', () => {
        const sub = makeSubtask({ id: 's1', parentId: 't1', startDate: '2024-01-03', endDate: '2024-01-20' });
        const tasks = [makeTask({ id: 't1', startDate: '2024-01-01', endDate: '2024-01-10', subtasks: [sub] })];
        const issues = detectIssues(tasks);
        expect(issues).toHaveLength(1);
        expect(issues[0]).toMatchObject({ type: 'subtask-fit', subtaskId: 's1', parentId: 't1' });
    });

    it('detects subtask-fit issue when subtask starts before parent starts', () => {
        const sub = makeSubtask({ id: 's1', parentId: 't1', startDate: '2023-12-01', endDate: '2024-01-05' });
        const tasks = [makeTask({ id: 't1', startDate: '2024-01-01', endDate: '2024-01-10', subtasks: [sub] })];
        const issues = detectIssues(tasks);
        expect(issues).toHaveLength(1);
        expect(issues[0]).toMatchObject({ type: 'subtask-fit', subtaskId: 's1' });
    });

    it('does NOT flag subtask-fit when subtask fits exactly within parent', () => {
        const sub = makeSubtask({ id: 's1', parentId: 't1', startDate: '2024-01-01', endDate: '2024-01-10' });
        const tasks = [makeTask({ id: 't1', startDate: '2024-01-01', endDate: '2024-01-10', subtasks: [sub] })];
        expect(detectIssues(tasks)).toEqual([]);
    });

    it('does NOT flag subtask-fit when parent has no dates', () => {
        const sub = makeSubtask({ id: 's1', parentId: 't1', startDate: '2024-01-01', endDate: '2024-01-20' });
        const tasks = [makeTask({ id: 't1', subtasks: [sub] })];
        expect(detectIssues(tasks)).toEqual([]);
    });

    it('returns multiple issues across tasks', () => {
        const taskA = makeTask({ id: 'a', title: 'A', startDate: '2024-01-01', endDate: '2024-01-10' });
        const taskB = makeTask({ id: 'b', title: 'B', startDate: '2024-01-05', endDate: '2024-01-15', dependsOn: ['a'] });
        const sub = makeSubtask({ id: 's1', parentId: 'a', startDate: '2024-01-01', endDate: '2024-01-20' });
        const taskWithSub = { ...taskA, subtasks: [sub] };
        const issues = detectIssues([taskWithSub, taskB]);
        expect(issues.length).toBeGreaterThanOrEqual(2);
    });
});
