const GIT_PROVIDER_CONFIG: Partial<Record<string, { host: string; commitSegment: string; changelogSegment?: string }>> = {
    github: { host: 'github.com', commitSegment: 'commit', changelogSegment: 'releases' },
    gitlab: { host: 'gitlab.com', commitSegment: '-/commit', changelogSegment: '-/releases' },
    bitbucket: { host: 'bitbucket.org', commitSegment: 'commits' }
};

export default function DeploymentInfo() {
    const commitSha = import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA;
    const deploymentId = import.meta.env.VITE_VERCEL_DEPLOYMENT_ID;
    const gitProvider = import.meta.env.VITE_VERCEL_GIT_PROVIDER;
    const gitRepoOwner = import.meta.env.VITE_VERCEL_GIT_REPO_OWNER;
    const gitRepoSlug = import.meta.env.VITE_VERCEL_GIT_REPO_SLUG;
    const hasDeploymentInfo = !!commitSha || !!deploymentId;

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

    if (!hasDeploymentInfo && !changelogUrl) {
        return null;
    }

    return (
        <div className="text-xs text-gray-500 leading-tight">
            {commitSha && (
                commitUrlBase
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
                    )
            )}
            {commitSha && deploymentId && <span> · </span>}
            {deploymentId && (
                <span title={deploymentId}>
                    {deploymentId.length > 10 ? `${deploymentId.slice(0, 10)}…` : deploymentId}
                </span>
            )}
            {hasDeploymentInfo && !!changelogUrl && <span> · </span>}
            {changelogUrl && (
                <a
                    href={changelogUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-gray-700 transition"
                >
                    changelog
                </a>
            )}
        </div>
    );
}
