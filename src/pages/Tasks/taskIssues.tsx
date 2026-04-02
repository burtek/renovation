/**
 * Task Issue detection and fixing — strategy-pattern plugin registry.
 *
 * Each issue type is self-contained in one place:
 *   • the TypeScript interface that describes the issue
 *   • a `detect()` function that scans the task list
 *   • a Fix component that the user clicks to resolve the issue
 *
 * To add a new issue type, implement a `TaskIssuePlugin` and append it to
 * `issuePlugins` at the bottom of this file.
 */

import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useApp } from '../../contexts/AppContext';
import type { Task } from '../../types';

import { addDays, dayDiff } from './types';


// ── Plugin interface ─────────────────────────────────────────────────────────

export interface TaskIssuePlugin {
    /** Scan the full task list and return every issue of this type. */
    detect: (tasks: Task[]) => TaskIssue[];
    /** Stable React key for the issue (must be unique across all plugins). */
    key: (issue: TaskIssue) => string;
    /** Returns true when this plugin is responsible for the given issue. */
    handles: (issue: TaskIssue) => boolean;
    /** Renders fix action(s) inside the issues popup. */
    renderFix: (issue: TaskIssue, onFixed: () => void) => ReactNode;
}


// ── Issue type 1: Dependency-order violation ─────────────────────────────────

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

function DependencyOrderFix({
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

const dependencyOrderPlugin: TaskIssuePlugin = {
    detect(tasks) {
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
    },

    key: issue => {
        if (issue.type === 'dependency-order') {
            return `dep-${issue.dependentId}-${issue.dependencyId}`;
        }
        return issue.type;
    },

    handles: issue => issue.type === 'dependency-order',

    renderFix: (issue, onFixed) => {
        if (issue.type !== 'dependency-order') {
            return null;
        }
        return (
            <DependencyOrderFix
                issue={issue}
                onFixed={onFixed}
            />
        );
    }
};


// ── Issue type 2: Subtask date range exceeds parent task ─────────────────────

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

function SubtaskFitFix({
    issue,
    onFixed
}: {
    issue: SubtaskFitIssue;
    onFixed: () => void;
}) {
    const { state: { tasks }, dispatch } = useApp();
    const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
    const fixBtnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const startViolation = issue.parentStartDate && issue.subtaskStartDate && issue.subtaskStartDate < issue.parentStartDate;
    const endViolation = issue.parentEndDate && issue.subtaskEndDate && issue.subtaskEndDate > issue.parentEndDate;

    const openMenu = () => {
        const rect = fixBtnRef.current?.getBoundingClientRect();
        if (rect) {
            setMenuPos({ top: rect.bottom + 4, left: rect.left });
        }
    };

    const closeMenu = () => {
        setMenuPos(null);
    };

    const shortenSubtask = () => {
        const parentTask = tasks.find(t => t.id === issue.parentId);
        const sub = parentTask?.subtasks.find(s => s.id === issue.subtaskId);
        if (!parentTask || !sub) {
            return;
        }
        dispatch({
            type: 'UPDATE_SUBTASK',
            payload: {
                taskId: parentTask.id,
                subtask: {
                    ...sub,
                    startDate: startViolation ? issue.parentStartDate : sub.startDate,
                    endDate: endViolation ? issue.parentEndDate : sub.endDate
                }
            }
        });
        closeMenu();
        onFixed();
    };

    const extendParent = () => {
        const parentTask = tasks.find(t => t.id === issue.parentId);
        if (!parentTask) {
            return;
        }
        dispatch({
            type: 'UPDATE_TASK',
            payload: {
                ...parentTask,
                startDate: startViolation ? issue.subtaskStartDate : parentTask.startDate,
                endDate: endViolation ? issue.subtaskEndDate : parentTask.endDate
            }
        });
        closeMenu();
        onFixed();
    };

    return (
        <div className="flex flex-col gap-1">
            <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">Subtask &ldquo;{issue.subtaskTitle}&rdquo;</span>
                {' '}
                (
                {issue.subtaskStartDate ?? '?'}
                {' '}
                –
                {' '}
                {issue.subtaskEndDate ?? '?'}
                )
                {' '}
                doesn&apos;t fit in parent task
                {' '}
                <span className="font-medium">&ldquo;{issue.parentTitle}&rdquo;</span>
                {' '}
                (
                {issue.parentStartDate ?? '?'}
                {' '}
                –
                {' '}
                {issue.parentEndDate ?? '?'}
                ).
            </p>
            <button
                ref={fixBtnRef}
                type="button"
                onClick={menuPos ? closeMenu : openMenu}
                className="self-start text-xs bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-2 py-1 rounded"
            >
                Fix ▾
            </button>
            {menuPos && createPortal(
                <>
                    {/* Transparent backdrop — captures any click outside the menu */}
                    <div
                        aria-hidden="true"
                        className="fixed inset-0 z-[59]"
                        onClick={closeMenu}
                    />
                    <div
                        ref={menuRef}
                        style={{ position: 'fixed', top: menuPos.top, left: menuPos.left }}
                        className="z-[60] bg-white dark:bg-gray-700 border dark:border-gray-600 rounded shadow-lg min-w-max"
                    >
                        <button
                            type="button"
                            onClick={shortenSubtask}
                            className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                        >
                            Shorten subtask to fit parent
                        </button>
                        <button
                            type="button"
                            onClick={extendParent}
                            className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                        >
                            Extend parent to fit subtask
                        </button>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}

const subtaskFitPlugin: TaskIssuePlugin = {
    detect(tasks) {
        const issues: SubtaskFitIssue[] = [];
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
    },

    key: issue => {
        if (issue.type === 'subtask-fit') {
            return `fit-${issue.subtaskId}`;
        }
        return issue.type;
    },

    handles: issue => issue.type === 'subtask-fit',

    renderFix: (issue, onFixed) => {
        if (issue.type !== 'subtask-fit') {
            return null;
        }
        return (
            <SubtaskFitFix
                issue={issue}
                onFixed={onFixed}
            />
        );
    }
};


// ── Plugin registry ──────────────────────────────────────────────────────────

export type TaskIssue = DependencyOrderIssue | SubtaskFitIssue;

/** All registered issue plugins. Add new entries here to support more issue types. */
export const issuePlugins: TaskIssuePlugin[] = [
    dependencyOrderPlugin,
    subtaskFitPlugin
];

/** Detect all issues across every registered plugin. */
export function detectIssues(tasks: Task[]): TaskIssue[] {
    return issuePlugins.flatMap(plugin => plugin.detect(tasks));
}
