function formatLocalDate(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear().toString()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const GIT_PROVIDER_CONFIG: Partial<Record<string, { host: string; commitSegment: string; changelogSegment?: string }>> = {
    github: { host: 'github.com', commitSegment: 'commit', changelogSegment: 'releases' },
    gitlab: { host: 'gitlab.com', commitSegment: '-/commit', changelogSegment: '-/releases' },
    bitbucket: { host: 'bitbucket.org', commitSegment: 'commits' }
};

export default function DeploymentInfo() {
    const env = import.meta.env.VITE_VERCEL_ENV;
    const commitSha = import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA;
    const deploymentId = import.meta.env.VITE_VERCEL_DEPLOYMENT_ID;
    const buildDate = import.meta.env.VITE_BUILD_DATE;
    const gitProvider = import.meta.env.VITE_VERCEL_GIT_PROVIDER;
    const gitRepoOwner = import.meta.env.VITE_VERCEL_GIT_REPO_OWNER;
    const gitRepoSlug = import.meta.env.VITE_VERCEL_GIT_REPO_SLUG;

    const providerConfig = gitProvider === undefined ? undefined : GIT_PROVIDER_CONFIG[gitProvider];
    const repoUrl = providerConfig !== undefined && gitRepoOwner !== undefined && gitRepoSlug !== undefined
        ? `https://${providerConfig.host}/${gitRepoOwner}/${gitRepoSlug}`
        : undefined;
    const commitUrlBase = providerConfig !== undefined && repoUrl !== undefined
        ? `${repoUrl}/${providerConfig.commitSegment}`
        : undefined;
    const changelogUrl = providerConfig?.changelogSegment !== undefined && repoUrl !== undefined
        ? `${repoUrl}/${providerConfig.changelogSegment}`
        : undefined;

    const deploymentUrl = deploymentId?.startsWith('dpl_') && import.meta.env.VITE_VERCEL_PROJECT
        ? `https://vercel.com/${import.meta.env.VITE_VERCEL_PROJECT}/${encodeURIComponent(deploymentId.slice(4))}`
        : undefined;

    const hasInfo = !!env || !!commitSha || !!deploymentId || !!buildDate || !!changelogUrl;
    if (!hasInfo) {
        return null;
    }

    return (
        <div className="text-xs text-gray-500 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
            {env && (
                <>
                    <span>Env:</span>
                    <span>{env}</span>
                </>
            )}
            {commitSha && (
                <>
                    <span>Commit:</span>
                    <span>
                        {commitUrlBase
                            ? (
                                <a
                                    href={`${commitUrlBase}/${commitSha}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
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
                            )}
                    </span>
                </>
            )}
            {deploymentId && (
                <>
                    <span>Deployment:</span>
                    <span className="truncate">
                        {deploymentUrl
                            ? (
                                <a
                                    href={deploymentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={deploymentId}
                                    className="underline hover:text-gray-700 transition"
                                >
                                    {deploymentId}
                                </a>
                            )
                            : (
                                <span title={deploymentId}>
                                    {deploymentId}
                                </span>
                            )}
                    </span>
                </>
            )}
            {buildDate && (
                <>
                    <span>Build date:</span>
                    <span title={buildDate}>{formatLocalDate(buildDate)}</span>
                </>
            )}
            {changelogUrl && (
                <a
                    href={changelogUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="col-span-2 underline hover:text-gray-700 transition"
                >
                    changelog
                </a>
            )}
        </div>
    );
}
