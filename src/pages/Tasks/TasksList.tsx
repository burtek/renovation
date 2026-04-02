import { useMemo, useState } from 'react';

import type { Subtask, Task } from '../../types';
import { cn } from '../../utils/classnames';


interface Props {
    tasks: Task[];
    onToggleTaskComplete: (task: Task) => void;
    onToggleSubtaskComplete: (taskId: string, subtask: Subtask) => void;
    onAddSubtask: (taskId: string) => void;
    onEditTask: (task: Task) => void;
    onDeleteTask: (id: string) => void;
    onEditSubtask: (taskId: string, subtask: Subtask) => void;
    onDuplicateSubtask: (taskId: string, subtask: Subtask) => void;
    onDeleteSubtask: (taskId: string, subtaskId: string) => void;
}

const CheckIcon = () => (
    <svg
        viewBox="0 0 20 20"
        fill="white"
        className="w-full h-full"
    >
        <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
        />
    </svg>
);

export default function TasksList({
    tasks,
    onToggleTaskComplete,
    onToggleSubtaskComplete,
    onAddSubtask,
    onEditTask,
    onDeleteTask,
    onEditSubtask,
    onDuplicateSubtask,
    onDeleteSubtask
}: Props) {
    const [expandedTasks, setExpandedTasks] = useState<Set<string>>(() => new Set());

    const { taskDependentCount, subtaskDependentCount } = useMemo(() => {
        const taskDeps = new Map<string, number>();
        const subtaskDeps = new Map<string, number>();
        for (const task of tasks) {
            for (const depId of task.dependsOn ?? []) {
                taskDeps.set(depId, (taskDeps.get(depId) ?? 0) + 1);
            }
            for (const sub of task.subtasks) {
                for (const depId of sub.dependsOn ?? []) {
                    subtaskDeps.set(depId, (subtaskDeps.get(depId) ?? 0) + 1);
                }
            }
        }
        return { taskDependentCount: taskDeps, subtaskDependentCount: subtaskDeps };
    }, [tasks]);

    const toggleExpand = (id: string) => {
        setExpandedTasks(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    return (
        <div className="space-y-3">
            {tasks.length === 0
                && <p className="text-gray-400 dark:text-gray-500 text-center py-8">No tasks yet. Create one!</p>}
            {tasks.map(task => {
                const taskDepOn = (task.dependsOn ?? []).length;
                const taskDepCount = taskDependentCount.get(task.id) ?? 0;
                return (
                    <div
                        key={task.id}
                        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700"
                    >
                        <div className="flex items-center p-4 gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => {
                                    onToggleTaskComplete(task);
                                }}
                                className={cn('w-5 h-5 rounded border-2 flex-shrink-0', task.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-500')}
                                title="Toggle complete"
                                aria-label={task.completed ? 'Mark task as incomplete' : 'Mark task as complete'}
                                aria-pressed={task.completed}
                            >
                                {task.completed && <CheckIcon />}
                            </button>
                            <div className="flex-1 min-w-0">
                                <span className={cn('font-medium', task.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100')}>{task.title}</span>
                                {task.assignee && <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">👤 {task.assignee}</span>}
                                {task.startDate && (
                                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                        📅 {task.startDate}{task.endDate ? ` → ${task.endDate}` : ''}
                                    </span>
                                )}
                                {taskDepOn > 0 && (
                                    <span
                                        className="ml-2 text-xs text-gray-500 dark:text-gray-400"
                                        role="img"
                                        aria-label={`Depends on ${taskDepOn} task(s)`}
                                        title={`Depends on ${taskDepOn} task(s)`}
                                    >⬆ {taskDepOn}
                                    </span>
                                )}
                                {taskDepCount > 0 && (
                                    <span
                                        className="ml-2 text-xs text-gray-500 dark:text-gray-400"
                                        role="img"
                                        aria-label={`${taskDepCount} task(s) depend on this`}
                                        title={`${taskDepCount} task(s) depend on this`}
                                    >⬇ {taskDepCount}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onAddSubtask(task.id);
                                    }}
                                    className="text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 dark:text-gray-300 px-2 py-1 rounded"
                                >+ Subtask
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onEditTask(task);
                                    }}
                                    className="text-xs bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 px-2 py-1 rounded"
                                >Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onDeleteTask(task.id);
                                    }}
                                    className="text-xs bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 px-2 py-1 rounded"
                                >Delete
                                </button>
                                {task.subtasks.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            toggleExpand(task.id);
                                        }}
                                        className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 ml-1"
                                        aria-label={expandedTasks.has(task.id) ? `Collapse subtasks for ${task.title}` : `Expand subtasks for ${task.title}`}
                                        aria-expanded={expandedTasks.has(task.id)}
                                    >
                                        {expandedTasks.has(task.id) ? '▲' : '▼'}
                                    </button>
                                )}
                            </div>
                        </div>
                        {expandedTasks.has(task.id) && task.subtasks.length > 0 && (
                            <div className="border-t dark:border-gray-700 ml-8">
                                {task.subtasks.map(sub => {
                                    const subDepOn = (sub.dependsOn ?? []).length;
                                    const subDepCount = subtaskDependentCount.get(sub.id) ?? 0;
                                    return (
                                        <div
                                            key={sub.id}
                                            className="flex items-center p-3 gap-3 border-b dark:border-gray-700 last:border-b-0 bg-gray-50 dark:bg-gray-700/50"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onToggleSubtaskComplete(task.id, sub);
                                                }}
                                                className={cn('w-4 h-4 rounded border-2 flex-shrink-0', sub.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-500')}
                                                title="Toggle complete"
                                                aria-label={sub.completed ? 'Mark subtask as incomplete' : 'Mark subtask as complete'}
                                                aria-pressed={sub.completed}
                                            >
                                                {sub.completed && <CheckIcon />}
                                            </button>
                                            <span className={cn('flex-1 text-sm', sub.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300')}>{sub.title}</span>
                                            {sub.assignee && <span className="text-xs text-gray-500 dark:text-gray-400">👤 {sub.assignee}</span>}
                                            {sub.startDate && <span className="text-xs text-gray-500 dark:text-gray-400">📅 {sub.startDate}{sub.endDate ? ` → ${sub.endDate}` : ''}</span>}
                                            {subDepOn > 0 && (
                                                <span
                                                    className="text-xs text-gray-500 dark:text-gray-400"
                                                    role="img"
                                                    aria-label={`Depends on ${subDepOn} subtask(s)`}
                                                    title={`Depends on ${subDepOn} subtask(s)`}
                                                >⬆ {subDepOn}
                                                </span>
                                            )}
                                            {subDepCount > 0 && (
                                                <span
                                                    className="text-xs text-gray-500 dark:text-gray-400"
                                                    role="img"
                                                    aria-label={`${subDepCount} subtask(s) depend on this`}
                                                    title={`${subDepCount} subtask(s) depend on this`}
                                                >⬇ {subDepCount}
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onEditSubtask(task.id, sub);
                                                }}
                                                className="text-xs bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 px-2 py-1 rounded"
                                            >Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onDuplicateSubtask(task.id, sub);
                                                }}
                                                className="text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 dark:text-gray-300 px-2 py-1 rounded"
                                            >Dup
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onDeleteSubtask(task.id, sub.id);
                                                }}
                                                className="text-xs bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 px-2 py-1 rounded"
                                            >Del
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
