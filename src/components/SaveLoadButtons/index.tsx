import type { ChangeEvent, KeyboardEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useApp } from '../../contexts/AppContext';
import { useNow } from '../../hooks/useNow';
import { storageManager } from '../../storage';

import DeploymentInfo from './DeploymentInfo';


function formatBytes(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(iso: string, now: number): string {
    const diff = now - new Date(iso).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) {
        return 'just now';
    }
    const mins = Math.floor(secs / 60);
    if (mins < 60) {
        return `${mins.toString()} min ago`;
    }
    const hours = Math.floor(mins / 60);
    if (hours < 24) {
        return `${hours.toString()} h ago`;
    }
    return new Date(iso).toLocaleDateString();
}

export { formatBytes, formatRelativeTime };

export default function SaveLoadButtons() {
    const { saveToFile, loadFromFile, projectMeta, openProjectSelector, renameProject, saveError, clearSaveError } = useApp();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const now = useNow();

    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState('');

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            loadFromFile(file);
            e.target.value = '';
        }
    };

    const commitRename = useCallback(() => {
        const trimmed = nameValue.trim();
        if (trimmed && projectMeta && trimmed !== projectMeta.name) {
            renameProject(trimmed);
        }
        setEditingName(false);
    }, [nameValue, projectMeta, renameProject]);

    const handleNameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            commitRename();
        } else if (e.key === 'Escape') {
            setEditingName(false);
        }
    };

    // Recompute only when the active project or its last save time changes
    const [projectSize, setProjectSize] = useState<number | null>(null);
    useEffect(() => {
        let isMounted = true;
        async function updateSize() {
            if (projectMeta) {
                const size = await storageManager.provider.getProjectSize(projectMeta.id);
                if (isMounted) {
                    setProjectSize(size);
                }
            } else {
                setProjectSize(null);
            }
        }
        void updateSize();
        return () => {
            isMounted = false;
        };
    }, [projectMeta]);

    return (
        <div className="flex flex-col gap-1 p-4">
            {projectMeta && (
                <div className="mb-2 text-xs text-gray-300 space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                        <span className="font-medium text-white truncate flex items-center gap-1 min-w-0">
                            <span>📁</span>
                            {editingName
                                ? (
                                    <input
                                        autoFocus
                                        type="text"
                                        value={nameValue}
                                        onChange={e => {
                                            setNameValue(e.target.value);
                                        }}
                                        onBlur={commitRename}
                                        onKeyDown={handleNameKeyDown}
                                        aria-label="Project name"
                                        className={[
                                            'bg-transparent border-b border-gray-400',
                                            'focus:border-white outline-none',
                                            'text-white font-medium text-xs w-full min-w-0'
                                        ].join(' ')}
                                    />
                                )
                                : (
                                    <button
                                        type="button"
                                        title="Click to rename"
                                        onClick={() => {
                                            setNameValue(projectMeta.name);
                                            setEditingName(true);
                                        }}
                                        className={[
                                            'truncate text-left text-white font-medium',
                                            'hover:text-gray-200 transition bg-transparent border-0 p-0 cursor-text'
                                        ].join(' ')}
                                    >
                                        {projectMeta.name}
                                    </button>
                                )}
                        </span>
                        <button
                            type="button"
                            onClick={openProjectSelector}
                            className="shrink-0 text-gray-400 hover:text-white transition text-[10px] leading-none"
                            title="Switch project"
                            aria-label="Switch project"
                        >
                            🔄
                        </button>
                    </div>
                    <div title="Last modified time">
                        {'💾 '}
                        {formatRelativeTime(projectMeta.lastModified, now)}
                    </div>
                    <div title="Project file size">
                        {'📊 '}
                        {projectSize === null ? 'unknown' : formatBytes(projectSize)}
                    </div>
                    <div className="text-[10px] text-gray-500">
                        {'🗄️ '}
                        {storageManager.provider.label}
                    </div>
                </div>
            )}
            {saveError && (
                <div
                    role="alert"
                    className="mb-1 flex items-start gap-1 rounded bg-red-900/60 px-2 py-1 text-xs text-red-300"
                >
                    <span className="min-w-0 flex-1 break-words">
                        {'⚠️ '}
                        {saveError}
                    </span>
                    <button
                        type="button"
                        aria-label="Dismiss save error"
                        onClick={clearSaveError}
                        className="shrink-0 text-red-400 hover:text-red-200 transition leading-none"
                    >
                        ✕
                    </button>
                </div>
            )}
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={saveToFile}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-3 rounded transition"
                >
                    💾 Save
                </button>
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white text-sm py-2 px-3 rounded transition"
                >
                    📂 Load
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.json.gz"
                    className="hidden"
                    onChange={handleFileChange}
                />
            </div>
            <DeploymentInfo />
        </div>
    );
}
