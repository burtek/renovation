/**
 * Subtask-fit issue: a subtask's date range extends outside its parent task's date range.
 *
 * Self-contained module — defines:
 *   • the TypeScript interface for this issue type
 *   • detectSubtaskFitIssues() — finds all violations in a task list
 *   • SubtaskFitFix — the React component that lets the user fix the issue
 */

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useApp } from '../../../contexts/AppContext';
import type { Task } from '../../../types';


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

export function detectSubtaskFitIssues(tasks: Task[]): SubtaskFitIssue[] {
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
}

export function SubtaskFitFix({
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
