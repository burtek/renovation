import type { KeyboardEvent } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

import type { ProjectMeta } from '../../storage';
import { cn } from '../../utils/classnames';


interface ProjectModalProps {
    projects: ProjectMeta[];
    onSelect: (id: string) => void;
    onCreate: (name: string) => void;
}

export default function ProjectModal({ projects, onSelect, onCreate }: ProjectModalProps) {
    const titleId = useId();
    const dialogRef = useRef<HTMLDivElement>(null);
    const firstProjectButtonRef = useRef<HTMLButtonElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);

    const [newName, setNewName] = useState('');
    const [showNewForm, setShowNewForm] = useState(projects.length === 0);
    const [nameError, setNameError] = useState('');

    // Focus the first interactive element when the dialog opens
    useEffect(() => {
        if (projects.length > 0) {
            firstProjectButtonRef.current?.focus();
        } else {
            nameInputRef.current?.focus();
        }
    }, [projects.length]);

    const handleCreate = () => {
        const trimmed = newName.trim();
        if (!trimmed) {
            setNameError('Please enter a project name.');
            return;
        }
        onCreate(trimmed);
    };

    // Keep Tab / Shift+Tab focus within the dialog
    const handleTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== 'Tab') {
            return;
        }
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
            'button, input, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) {
            return;
        }
        const focusableArray = Array.from(focusable);
        const [first] = focusableArray;
        const last = focusableArray[focusableArray.length - 1];
        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    };

    const formatDate = (iso: string) => {
        try {
            return new Date(iso).toLocaleString();
        } catch {
            return iso;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg shadow-xl max-w-md w-full p-6"
                onKeyDown={handleTabKeyDown}
            >
                <h2
                    id={titleId}
                    className="text-xl font-bold mb-4"
                >
                    🏠 Open Project
                </h2>

                {projects.length > 0 && (
                    <div className="mb-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                            Select an existing project:
                        </p>
                        <ul className="space-y-2 max-h-60 overflow-y-auto">
                            {projects.map((project, index) => (
                                <li key={project.id}>
                                    <button
                                        ref={index === 0 ? firstProjectButtonRef : undefined}
                                        type="button"
                                        onClick={() => {
                                            onSelect(project.id);
                                        }}
                                        className="w-full text-left px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 transition"
                                    >
                                        <div className="font-medium">
                                            {project.name}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            Last saved:
                                            {' '}
                                            {formatDate(project.lastModified)}
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {projects.length > 0 && !showNewForm && (
                    <button
                        type="button"
                        onClick={() => {
                            setShowNewForm(true);
                        }}
                        className={cn(
                            'w-full py-2 px-4 rounded-lg border-2 border-dashed',
                            'border-gray-300 dark:border-gray-600',
                            'text-gray-500 dark:text-gray-400',
                            'hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400',
                            'transition text-sm'
                        )}
                    >
                        + New Project
                    </button>
                )}

                {showNewForm && (
                    <form
                        onSubmit={e => {
                            e.preventDefault();
                            handleCreate();
                        }}
                        className={cn('space-y-3', projects.length > 0 && 'mt-2')}
                    >
                        {projects.length === 0 && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                No projects yet. Create your first project:
                            </p>
                        )}
                        <div>
                            <label
                                htmlFor={`${titleId}-name`}
                                className="block text-sm font-medium mb-1"
                            >
                                Project name
                            </label>
                            <input
                                ref={nameInputRef}
                                id={`${titleId}-name`}
                                type="text"
                                value={newName}
                                onChange={e => {
                                    setNewName(e.target.value);
                                    setNameError('');
                                }}
                                placeholder="e.g. Kitchen renovation"
                                className={cn(
                                    'w-full px-3 py-2 rounded border text-sm',
                                    'bg-white dark:bg-gray-700',
                                    'border-gray-300 dark:border-gray-600',
                                    'focus:outline-none focus:ring-2 focus:ring-blue-500',
                                    nameError && 'border-red-500 focus:ring-red-500'
                                )}
                            />
                            {nameError && (
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                    {nameError}
                                </p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="submit"
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-4 rounded transition"
                            >
                                Create Project
                            </button>
                            {projects.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowNewForm(false);
                                        setNewName('');
                                        setNameError('');
                                    }}
                                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
