import type { Task } from '../../types';
import { cn } from '../../utils/classnames';

import type { TaskFormData } from './types';


interface Props {
    editTask: Task | undefined;
    form: TaskFormData;
    allTasks: Task[];
    onFormChange: (update: Partial<TaskFormData>) => void;
    onSave: () => void;
    onClose: () => void;
}

export default function TaskModal({ editTask, form, allTasks, onFormChange, onSave, onClose }: Props) {
    const otherTasks = allTasks.filter(t => t.id !== editTask?.id);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl max-h-screen overflow-y-auto">
                <h2 className="text-lg font-bold mb-4 dark:text-gray-100">{editTask ? 'Edit Task' : 'New Task'}</h2>
                <div className="space-y-3">
                    <input
                        placeholder="Title *"
                        value={form.title}
                        onChange={e => {
                            onFormChange({ title: e.target.value });
                        }}
                        className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 dark:text-gray-100"
                    />
                    <textarea
                        placeholder="Notes"
                        value={form.notes}
                        onChange={e => {
                            onFormChange({ notes: e.target.value });
                        }}
                        className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm h-20 focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 dark:text-gray-100"
                    />
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Start date</label>
                            <input
                                type="date"
                                value={form.startDate}
                                onChange={e => {
                                    const startDate = e.target.value;
                                    onFormChange({ startDate, endDate: form.endDate || startDate });
                                }}
                                className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 dark:text-gray-100"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">End date</label>
                            <input
                                type="date"
                                value={form.endDate}
                                min={form.startDate}
                                onChange={e => {
                                    onFormChange({ endDate: e.target.value });
                                }}
                                className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 dark:text-gray-100"
                            />
                        </div>
                    </div>
                    <input
                        placeholder="Assignee"
                        value={form.assignee}
                        onChange={e => {
                            onFormChange({ assignee: e.target.value });
                        }}
                        className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 dark:text-gray-100"
                    />
                    <label className="flex items-center gap-2 text-sm dark:text-gray-300">
                        <input
                            type="checkbox"
                            checked={form.completed}
                            onChange={e => {
                                onFormChange({ completed: e.target.checked });
                            }}
                        />
                        {' '}
                        Completed
                    </label>

                    {otherTasks.length > 0 && (
                        <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Depends on (tasks):</label>
                            <div className="max-h-32 overflow-y-auto border dark:border-gray-600 rounded p-2 space-y-1 bg-white dark:bg-gray-700">
                                {otherTasks.map(t => (
                                    <label
                                        key={t.id}
                                        className="flex items-center gap-2 text-sm cursor-pointer dark:text-gray-300"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={form.dependsOn.includes(t.id)}
                                            onChange={e => {
                                                onFormChange({
                                                    dependsOn: e.target.checked
                                                        ? [...form.dependsOn, t.id]
                                                        : form.dependsOn.filter(id => id !== t.id)
                                                });
                                            }}
                                        />
                                        <span className={cn(t.completed && 'line-through text-gray-400 dark:text-gray-500')}>{t.title}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex gap-2 mt-4 justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    >Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >Save
                    </button>
                </div>
            </div>
        </div>
    );
}
