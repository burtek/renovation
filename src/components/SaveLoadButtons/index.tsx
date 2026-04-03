import type { ChangeEvent } from 'react';
import { useRef } from 'react';

import { useApp } from '../../contexts/AppContext';
import { defaultStorageProvider } from '../../storage';

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

function formatRelativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
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

export default function SaveLoadButtons() {
    const { saveToFile, loadFromFile, projectMeta, openProjectSelector } = useApp();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            loadFromFile(file);
            e.target.value = '';
        }
    };

    const storageUsed = projectMeta ? defaultStorageProvider.getProjectSize(projectMeta.id) : 0;

    return (
        <div className="flex flex-col gap-1 p-4">
            {projectMeta && (
                <div className="mb-2 text-xs text-gray-300 space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                        <span
                            className="font-medium text-white truncate"
                            title={projectMeta.name}
                        >
                            📁
                            {' '}
                            {projectMeta.name}
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
                    <div>
                        💾
                        {' '}
                        {formatRelativeTime(projectMeta.lastModified)}
                    </div>
                    <div>
                        📊
                        {' '}
                        {formatBytes(storageUsed)}
                    </div>
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
