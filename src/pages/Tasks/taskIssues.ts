import type { Task } from '../../types';


export interface DependencyOrderIssue {
    type: 'dependency-order';
    dependentId: string;
    dependentTitle: string;
    /** null when the dependent is a top-level task; parent task id when it is a subtask */
    dependentParentId: string | null;
    dependencyId: string;
    dependencyTitle: string;
    dependentStartDate: string;
    dependencyEndDate: string;
}

export interface SubtaskFitIssue {
    type: 'subtask-fit';
    subtaskId: string;
    subtaskTitle: string;
    subtaskStartDate: string | undefined;
    subtaskEndDate: string | undefined;
    parentId: string;
    parentTitle: string;
    parentStartDate: string | undefined;
    parentEndDate: string | undefined;
}

export type TaskIssue = DependencyOrderIssue | SubtaskFitIssue;

export function detectIssues(tasks: Task[]): TaskIssue[] {
    const issues: TaskIssue[] = [];
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    const subtaskParentMap = new Map<string, string>();
    const subtaskEndMap = new Map<string, string>();
    tasks.forEach(task => {
        task.subtasks.forEach(sub => {
            subtaskParentMap.set(sub.id, task.id);
            if (sub.endDate) {
                subtaskEndMap.set(sub.id, sub.endDate);
            }
        });
    });

    // Issue 1a: task-level dependency order violations
    tasks.forEach(task => {
        const taskStart = task.startDate;
        if (!taskStart) {
            return;
        }
        (task.dependsOn ?? []).forEach(depId => {
            const dep = taskMap.get(depId);
            if (!dep?.endDate) {
                return;
            }
            if (taskStart < dep.endDate) {
                issues.push({
                    type: 'dependency-order',
                    dependentId: task.id,
                    dependentTitle: task.title,
                    dependentParentId: null,
                    dependencyId: depId,
                    dependencyTitle: dep.title,
                    dependentStartDate: taskStart,
                    dependencyEndDate: dep.endDate
                });
            }
        });
    });

    // Issue 1b: subtask-level dependency order violations
    tasks.forEach(task => {
        task.subtasks.forEach(sub => {
            const subStart = sub.startDate;
            if (!subStart) {
                return;
            }
            (sub.dependsOn ?? []).forEach(depId => {
                const depEnd = subtaskEndMap.get(depId);
                if (!depEnd) {
                    return;
                }

                // find title of the dependency subtask
                const depParentId = subtaskParentMap.get(depId);
                const depTitle = depParentId
                    ? taskMap.get(depParentId)?.subtasks.find(s => s.id === depId)?.title ?? depId
                    : depId;

                if (subStart < depEnd) {
                    issues.push({
                        type: 'dependency-order',
                        dependentId: sub.id,
                        dependentTitle: sub.title,
                        dependentParentId: task.id,
                        dependencyId: depId,
                        dependencyTitle: depTitle,
                        dependentStartDate: subStart,
                        dependencyEndDate: depEnd
                    });
                }
            });
        });
    });

    // Issue 2: subtask date range doesn't fit within parent task date range
    tasks.forEach(task => {
        task.subtasks.forEach(sub => {
            const startViolation = task.startDate && sub.startDate && sub.startDate < task.startDate;
            const endViolation = task.endDate && sub.endDate && sub.endDate > task.endDate;
            if (startViolation || endViolation) {
                issues.push({
                    type: 'subtask-fit',
                    subtaskId: sub.id,
                    subtaskTitle: sub.title,
                    subtaskStartDate: sub.startDate,
                    subtaskEndDate: sub.endDate,
                    parentId: task.id,
                    parentTitle: task.title,
                    parentStartDate: task.startDate,
                    parentEndDate: task.endDate
                });
            }
        });
    });

    return issues;
}
