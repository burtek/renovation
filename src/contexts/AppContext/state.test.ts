import type { AppData, Subtask, Task } from '../../types';

import type { Action } from './state';
import { reducer } from './state';


const emptyState: AppData = {
    notes: [],
    tasks: [],
    expenses: [],
    calendarEvents: [],
    budget: 0
};

function makeSubtask(overrides: Partial<Subtask> = {}): Subtask {
    return {
        id: 'sub-1',
        parentId: 'task-1',
        title: 'Subtask',
        notes: '',
        completed: false,
        ...overrides
    };
}

function makeTask(overrides: Partial<Task> = {}): Task {
    return {
        id: 'task-1',
        title: 'Task',
        notes: '',
        subtasks: [],
        completed: false,
        ...overrides
    };
}

describe('reducer', () => {
    describe('DELETE_TASK', () => {
        it('skips (returns same ref) a sibling subtask with no dependsOn when subtasksNeedCleaning', () => {
            // taskA has subtask s1; taskB has s2 (depends on s1) AND s3 (no dependsOn).
            // When taskA is deleted, subtasksNeedCleaning=true for taskB.
            // s3 should be returned unchanged (line 62 path: !s.dependsOn?.length → return s)
            const taskA = makeTask({
                id: 'tA',
                subtasks: [makeSubtask({ id: 's1', parentId: 'tA' })]
            });
            const taskB = makeTask({
                id: 'tB',
                subtasks: [
                    makeSubtask({ id: 's2', parentId: 'tB', dependsOn: ['s1'] }),
                    makeSubtask({ id: 's3', parentId: 'tB' }) // no dependsOn
                ]
            });
            const state: AppData = { ...emptyState, tasks: [taskA, taskB] };

            const next = reducer(state, { type: 'DELETE_TASK', payload: 'tA' });

            expect(next.tasks).toHaveLength(1);
            expect(next.tasks[0].subtasks).toHaveLength(2);
            // s2's dependsOn should be cleaned
            expect(next.tasks[0].subtasks.find(s => s.id === 's2')?.dependsOn).not.toContain('s1');
            // s3 should be returned as the same object reference (the "return s" branch)
            expect(next.tasks[0].subtasks.find(s => s.id === 's3')).toBe(taskB.subtasks[1]);
        });
    });

    describe('DELETE_SUBTASK', () => {
        it('skips (returns same ref) subtasks with no dependsOn while cleaning dependsOn in others', () => {
            // Task has s1 (to delete), s2 (depends on s1), s3 (no dependsOn).
            // After deleting s1: filteredSubtasks = [s2, s3].
            // s3 has no dependsOn → hits the "return s" branch (line 102).
            const task = makeTask({
                id: 'tA',
                subtasks: [
                    makeSubtask({ id: 's1', parentId: 'tA' }),
                    makeSubtask({ id: 's2', parentId: 'tA', dependsOn: ['s1'] }),
                    makeSubtask({ id: 's3', parentId: 'tA' }) // no dependsOn
                ]
            });
            const state: AppData = { ...emptyState, tasks: [task] };

            const next = reducer(state, { type: 'DELETE_SUBTASK', payload: { taskId: 'tA', subtaskId: 's1' } });

            const remaining = next.tasks[0].subtasks;
            expect(remaining).toHaveLength(2);
            // s2's dependsOn should be cleaned
            expect(remaining.find(s => s.id === 's2')?.dependsOn).not.toContain('s1');
            // s3 should be returned as the same object reference (the "return s" branch)
            expect(remaining.find(s => s.id === 's3')).toBe(task.subtasks[2]);
        });
    });

    it('returns the same state for unknown action types', () => {
        // The exhaustive switch has a fallthrough "return state" (line 130) for
        // unknown actions that can only be reached at runtime via type casting.
        const state: AppData = { ...emptyState, budget: 42 };
        const next = reducer(state, { type: 'UNKNOWN_ACTION' } as unknown as Action);
        expect(next).toBe(state);
    });
});
