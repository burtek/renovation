/**
 * Dependency-order issue: a task/subtask starts before one of its dependencies ends.
 *
 * Self-contained module — defines:
 *   • the TypeScript interface for this issue type
 *   • detectDependencyOrderIssues() — finds all violations in a task list
 *   • DependencyOrderFix — the React component that lets the user fix the issue
 */

import { useApp } from '../../../contexts/AppContext';
import type { Task } from '../../../types';
import { addDays, dayDiff } from '../types';


export interface DependencyOrderIssue {
    type: 'dependency-order';
    /** Id of the item that starts too early */
    dependentId: string;
    dependentTitle: string;
    /** null for a top-level task; parent task id for a subtask */
    dependentParentId: string | null;
    dependencyId: string;
    dependencyTitle: string;
    dependentStartDate: string;
    dependencyEndDate: string;
}

export function detectDependencyOrderIssues(tasks: Task[]): DependencyOrderIssue[] {
    const issues: DependencyOrderIssue[] = [];
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

    // Task-level violations
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

    // Subtask-level violations
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

    return issues;
}

export function DependencyOrderFix({
    issue,
    onFixed
}: {
    issue: DependencyOrderIssue;
    onFixed: () => void;
}) {
    const { state: { tasks }, dispatch } = useApp();

    const handleFix = () => {
        const shift = dayDiff(issue.dependencyEndDate, issue.dependentStartDate);

        if (issue.dependentParentId === null) {
            const task = tasks.find(t => t.id === issue.dependentId);
            if (!task) {
                return;
            }
            dispatch({
                type: 'UPDATE_TASK',
                payload: {
                    ...task,
                    startDate: issue.dependencyEndDate,
                    endDate: task.endDate ? addDays(task.endDate, shift) : task.endDate
                }
            });
        } else {
            const parentTask = tasks.find(t => t.id === issue.dependentParentId);
            const sub = parentTask?.subtasks.find(s => s.id === issue.dependentId);
            if (!parentTask || !sub) {
                return;
            }
            dispatch({
                type: 'UPDATE_SUBTASK',
                payload: {
                    taskId: parentTask.id,
                    subtask: {
                        ...sub,
                        startDate: issue.dependencyEndDate,
                        endDate: sub.endDate ? addDays(sub.endDate, shift) : sub.endDate
                    }
                }
            });
        }
        onFixed();
    };

    return (
        <div className="flex flex-col gap-1">
            <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">
                    {issue.dependentParentId ? 'Subtask' : 'Task'}
                    {' '}
                    &ldquo;{issue.dependentTitle}&rdquo;
                </span>
                {' '}
                starts on
                {' '}
                {issue.dependentStartDate}
                {' '}
                but dependency
                {' '}
                <span className="font-medium">&ldquo;{issue.dependencyTitle}&rdquo;</span>
                {' '}
                ends on
                {' '}
                {issue.dependencyEndDate}
                .
            </p>
            <button
                type="button"
                onClick={handleFix}
                className="self-start text-xs bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-2 py-1 rounded"
            >
                Move start date to {issue.dependencyEndDate}
            </button>
        </div>
    );
}
