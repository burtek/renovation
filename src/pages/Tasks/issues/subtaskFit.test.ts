import type { Task } from '../../../types';

import { detectSubtaskFitIssues } from './subtaskFit';


function makeTask(overrides: Partial<Task> = {}): Task {
    return {
        id: 't1',
        title: 'Parent',
        notes: '',
        completed: false,
        subtasks: [],
        dependsOn: [],
        ...overrides
    };
}

describe('detectSubtaskFitIssues', () => {
    it('returns empty array for empty task list', () => {
        expect(detectSubtaskFitIssues([])).toEqual([]);
    });

    it('returns empty array when subtasks have no dates', () => {
        const tasks = [
            makeTask({
                id: 't1',
                startDate: '2024-01-01',
                endDate: '2024-01-10',
                subtasks: [
                    {
                        id: 's1',
                        parentId: 't1',
                        title: 'Sub',
                        notes: '',
                        completed: false,
                        dependsOn: []
                    }
                ]
            })
        ];
        expect(detectSubtaskFitIssues(tasks)).toEqual([]);
    });

    it('returns empty array when all subtasks fit inside their parent', () => {
        const tasks = [
            makeTask({
                id: 't1',
                startDate: '2024-01-01',
                endDate: '2024-01-10',
                subtasks: [
                    {
                        id: 's1',
                        parentId: 't1',
                        title: 'Sub',
                        notes: '',
                        completed: false,
                        startDate: '2024-01-02',
                        endDate: '2024-01-09',
                        dependsOn: []
                    }
                ]
            })
        ];
        expect(detectSubtaskFitIssues(tasks)).toEqual([]);
    });

    it('detects start-date violation: subtask starts before parent', () => {
        const tasks = [
            makeTask({
                id: 't1',
                title: 'Parent',
                startDate: '2024-01-05',
                endDate: '2024-01-10',
                subtasks: [
                    {
                        id: 's1',
                        parentId: 't1',
                        title: 'Sub',
                        notes: '',
                        completed: false,
                        startDate: '2024-01-03',
                        endDate: '2024-01-09',
                        dependsOn: []
                    }
                ]
            })
        ];
        const issues = detectSubtaskFitIssues(tasks);
        expect(issues).toHaveLength(1);
        expect(issues[0]).toMatchObject({
            type: 'subtask-fit',
            subtaskId: 's1',
            subtaskTitle: 'Sub',
            subtaskStartDate: '2024-01-03',
            subtaskEndDate: '2024-01-09',
            parentId: 't1',
            parentTitle: 'Parent',
            parentStartDate: '2024-01-05',
            parentEndDate: '2024-01-10'
        });
    });

    it('detects end-date violation: subtask ends after parent', () => {
        const tasks = [
            makeTask({
                id: 't1',
                title: 'Parent',
                startDate: '2024-01-01',
                endDate: '2024-01-08',
                subtasks: [
                    {
                        id: 's1',
                        parentId: 't1',
                        title: 'Sub',
                        notes: '',
                        completed: false,
                        startDate: '2024-01-02',
                        endDate: '2024-01-10',
                        dependsOn: []
                    }
                ]
            })
        ];
        const issues = detectSubtaskFitIssues(tasks);
        expect(issues).toHaveLength(1);
        expect(issues[0].type).toBe('subtask-fit');
        expect(issues[0].subtaskEndDate).toBe('2024-01-10');
        expect(issues[0].parentEndDate).toBe('2024-01-08');
    });

    it('detects both start and end violations in a single issue', () => {
        const tasks = [
            makeTask({
                id: 't1',
                startDate: '2024-01-05',
                endDate: '2024-01-08',
                subtasks: [
                    {
                        id: 's1',
                        parentId: 't1',
                        title: 'Sub',
                        notes: '',
                        completed: false,
                        startDate: '2024-01-01',
                        endDate: '2024-01-10',
                        dependsOn: []
                    }
                ]
            })
        ];
        const issues = detectSubtaskFitIssues(tasks);
        expect(issues).toHaveLength(1);
    });

    it('ignores start-date violation when parent has no startDate', () => {
        const tasks = [
            makeTask({
                id: 't1',
                startDate: undefined,
                endDate: '2024-01-08',
                subtasks: [
                    {
                        id: 's1',
                        parentId: 't1',
                        title: 'Sub',
                        notes: '',
                        completed: false,
                        startDate: '2024-01-01',
                        endDate: '2024-01-07',
                        dependsOn: []
                    }
                ]
            })
        ];
        expect(detectSubtaskFitIssues(tasks)).toEqual([]);
    });

    it('ignores end-date violation when parent has no endDate', () => {
        const tasks = [
            makeTask({
                id: 't1',
                startDate: '2024-01-01',
                endDate: undefined,
                subtasks: [
                    {
                        id: 's1',
                        parentId: 't1',
                        title: 'Sub',
                        notes: '',
                        completed: false,
                        startDate: '2024-01-02',
                        endDate: '2024-01-10',
                        dependsOn: []
                    }
                ]
            })
        ];
        expect(detectSubtaskFitIssues(tasks)).toEqual([]);
    });

    it('returns multiple issues for multiple violating subtasks', () => {
        const tasks = [
            makeTask({
                id: 't1',
                startDate: '2024-01-05',
                endDate: '2024-01-10',
                subtasks: [
                    {
                        id: 's1',
                        parentId: 't1',
                        title: 'Sub1',
                        notes: '',
                        completed: false,
                        startDate: '2024-01-03',
                        endDate: '2024-01-09',
                        dependsOn: []
                    },
                    {
                        id: 's2',
                        parentId: 't1',
                        title: 'Sub2',
                        notes: '',
                        completed: false,
                        startDate: '2024-01-06',
                        endDate: '2024-01-12',
                        dependsOn: []
                    }
                ]
            })
        ];
        expect(detectSubtaskFitIssues(tasks)).toHaveLength(2);
    });
});
