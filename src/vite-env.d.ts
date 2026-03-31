interface ImportMeta {
    readonly env: ImportMetaEnv;
}


interface ImportMetaEnv {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    readonly VITE_VERCEL_GIT_COMMIT_SHA?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    readonly VITE_VERCEL_DEPLOYMENT_ID?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    readonly VITE_GITHUB_REPO_URL?: string;
}
