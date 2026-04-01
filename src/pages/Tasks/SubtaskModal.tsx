import { useState } from 'react';

import type { Subtask } from '../../types';
import { cn } from '../../utils/classnames';

import type { SubtaskFormData } from './types';


interface SubtaskWithParent extends Subtask {
    parentTitle: string;
}

interface Props {
    editSubtask: Subtask | undefined;
    parentTaskTitle: string;
    form: SubtaskFormData;
    allSubtasks: SubtaskWithParent[];
    onFormChange: (update: Partial<SubtaskFormData>) => void;
    onSave: () => void;
    onSaveAndNew: () => void;
    onClose: () => void;
}

export default function SubtaskModal({ editSubtask, parentTaskTitle, form, allSubtasks, onFormChange, onSave, onSaveAndNew, onClose }: Props) {
    const otherSubtasks = allSubtasks.filter(s => s.id !== editSubtask?.id);
    const [depSearch, setDepSearch] = useState('');
    const lowerSearch = depSearch.trim().toLowerCase();
    const filteredSubtasks = lowerSearch
        ? otherSubtasks.filter(s => s.title.toLowerCase().includes(lowerSearch) || s.parentTitle.toLowerCase().includes(lowerSearch))
        : otherSubtasks;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl max-h-screen overflow-y-auto">
                <h2 className="text-lg font-bold mb-1 dark:text-gray-100">{editSubtask ? 'Edit Subtask' : 'New Subtask'}</h2>
                <p
                    className="text-sm text-gray-500 dark:text-gray-400 mb-4"
                    data-testid="subtask-modal-parent-title"
                >
                    {parentTaskTitle}
                </p>
                <div className="space-y-3">
                    <input
                        autoFocus
                        placeholder="Title *"
                        value={form.title}
                        onChange={e => {
                            onFormChange({ title: e.target.value });
                        }}
                        onKeyDown={e => {
                            if (e.repeat || e.nativeEvent.isComposing) {
                                return;
                            }
                            if (e.key === 'Enter' && e.shiftKey) {
                                e.preventDefault();
                                onSaveAndNew();
                            } else if (e.key === 'Enter') {
                                e.preventDefault();
                                onSave();
                            }
                        }}
                        className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 dark:text-gray-100"
                    />
                    <textarea
                        placeholder="Notes"
                        value={form.notes}
                        onChange={e => {
                            onFormChange({ notes: e.target.value });
                        }}
                        className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm h-16 focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 dark:text-gray-100"
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

                    {otherSubtasks.length > 0 && (
                        <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Depends on (subtasks):</label>
                            <input
                                placeholder="Search subtasks…"
                                value={depSearch}
                                onChange={e => {
                                    setDepSearch(e.target.value);
                                }}
                                className="w-full border dark:border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 dark:text-gray-100 mb-1"
                            />
                            <div className="max-h-32 overflow-y-auto border dark:border-gray-600 rounded p-2 space-y-1 bg-white dark:bg-gray-700">
                                {filteredSubtasks.map(s => (
                                    <label
                                        key={s.id}
                                        className="flex items-center gap-2 text-sm cursor-pointer dark:text-gray-300"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={form.dependsOn.includes(s.id)}
                                            onChange={e => {
                                                onFormChange({
                                                    dependsOn: e.target.checked
                                                        ? [...form.dependsOn, s.id]
                                                        : form.dependsOn.filter(id => id !== s.id)
                                                });
                                            }}
                                        />
                                        <span className={cn(s.completed && 'line-through text-gray-400 dark:text-gray-500')}>
                                            <span className="text-gray-400 dark:text-gray-500 text-xs">{s.parentTitle} › </span>
                                            {s.title}
                                        </span>
                                    </label>
                                ))}
                                {filteredSubtasks.length === 0 && depSearch.trim()
                                    && <p className="text-xs text-gray-400 dark:text-gray-500 py-1">No subtasks match your search.</p>}
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
