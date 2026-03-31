import type { ChangeEvent } from 'react';
import { useRef } from 'react';

import { useApp } from '../contexts/AppContext';


export default function SaveLoadButtons() {
    const { saveToFile, loadFromFile } = useApp();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const commitSha = import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA;
    const deploymentId = import.meta.env.VITE_VERCEL_DEPLOYMENT_ID;
    const repoUrl = import.meta.env.VITE_GITHUB_REPO_URL;
    const hasDeploymentInfo = !!commitSha || !!deploymentId;

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            loadFromFile(file);
            e.target.value = '';
        }
    };

    return (
        <div className="flex flex-col gap-1 p-4">
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
            {(hasDeploymentInfo || !!repoUrl) && (
                <div className="text-xs text-gray-500 leading-tight">
                    {commitSha && (
                        repoUrl
                            ? (
                                <a
                                    href={`${repoUrl}/commit/${commitSha}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title={commitSha}
                                    className="underline hover:text-gray-700 transition"
                                >
                                    {commitSha.slice(0, 7)}
                                </a>
                            )
                            : (
                                <span title={commitSha}>
                                    {commitSha.slice(0, 7)}
                                </span>
                            )
                    )}
                    {commitSha && deploymentId && <span> · </span>}
                    {deploymentId && <span>{deploymentId}</span>}
                    {hasDeploymentInfo && !!repoUrl && <span> · </span>}
                    {repoUrl && (
                        <a
                            href={`${repoUrl}/releases`}
                            target="_blank"
                            rel="noreferrer"
                            className="underline hover:text-gray-700 transition"
                        >
                            changelog
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}
