import { useEffect, useRef, useState } from 'react';

import { useApp } from '../../contexts/AppContext';
import { cn } from '../../utils/classnames';

import type { DependencyOrderIssue, SubtaskFitIssue, TaskIssue } from './taskIssues';
import { addDays, dayDiff } from './types';


interface Props {
    issues: TaskIssue[];
    isOpen: boolean;
    onClose: () => void;
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
            // top-level task
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
            // subtask
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

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (!menuPos) {
                return;
            }
            const { target } = e;
            if (
                target instanceof Node
                && !fixBtnRef.current?.contains(target)
                && !menuRef.current?.contains(target)
            ) {
                setMenuPos(null);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => {
            document.removeEventListener('mousedown', handleClick);
        };
    }, [menuPos]);

    const startViolation = issue.parentStartDate && issue.subtaskStartDate && issue.subtaskStartDate < issue.parentStartDate;
    const endViolation = issue.parentEndDate && issue.subtaskEndDate && issue.subtaskEndDate > issue.parentEndDate;

    const toggleMenu = () => {
        if (menuPos) {
            setMenuPos(null);
            return;
        }
        const rect = fixBtnRef.current?.getBoundingClientRect();
        if (rect) {
            setMenuPos({ top: rect.bottom + 4, left: rect.left });
        }
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
        setMenuPos(null);
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
        setMenuPos(null);
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
            <div className="self-start">
                <button
                    ref={fixBtnRef}
                    type="button"
                    onClick={toggleMenu}
                    className="text-xs bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-2 py-1 rounded"
                >
                    Fix ▾
                </button>
                {menuPos && (
                    <div
                        ref={menuRef}
                        style={{ position: 'fixed' as const, top: menuPos.top, left: menuPos.left }}
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
                )}
            </div>
        </div>
    );
}

export default function TaskIssuesPopup({ issues, isOpen, onClose }: Props) {
    const popupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (!isOpen) {
                return;
            }
            const { target } = e;
            if (popupRef.current && target instanceof Node && !popupRef.current.contains(target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => {
            document.removeEventListener('mousedown', handleClick);
        };
    }, [isOpen, onClose]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('keydown', handleKey);
        };
    }, [isOpen, onClose]);

    if (!isOpen) {
        return null;
    }

    return (
        <div
            ref={popupRef}
            className={cn(
                'absolute right-0 top-full mt-1 z-50',
                'w-[28rem] max-h-[70vh] overflow-y-auto',
                'bg-white dark:bg-gray-800 border dark:border-gray-700',
                'rounded-lg shadow-xl'
            )}
        >
            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
                <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
                    ⚠️ Task Issues ({issues.length})
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none"
                    aria-label="Close issues panel"
                >
                    ✕
                </button>
            </div>
            <ul className="divide-y dark:divide-gray-700">
                {issues.map(issue => (
                    <li
                        key={issue.type === 'dependency-order'
                            ? `dep-${issue.dependentId}-${issue.dependencyId}`
                            : `fit-${issue.subtaskId}`}
                        className="px-4 py-3"
                    >
                        {issue.type === 'dependency-order'
                            ? (
                                <DependencyOrderFix
                                    issue={issue}
                                    onFixed={onClose}
                                />
                            )
                            : (
                                <SubtaskFitFix
                                    issue={issue}
                                    onFixed={onClose}
                                />
                            )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
