/// <reference types="vite/client" />

interface ImportMeta {
    readonly env: ImportMetaEnv;
}


/* eslint-disable @typescript-eslint/naming-convention */
interface ImportMetaEnv {
    readonly VITE_VERCEL_ENV?: string;
    readonly VITE_VERCEL_GIT_COMMIT_SHA?: string;
    readonly VITE_VERCEL_DEPLOYMENT_ID?: string;
    readonly VITE_VERCEL_GIT_PROVIDER?: string;
    readonly VITE_VERCEL_GIT_REPO_OWNER?: string;
    readonly VITE_VERCEL_GIT_REPO_SLUG?: string;
    readonly VITE_BUILD_DATE?: string;
    readonly VITE_VERCEL_PROJECT?: string;
    readonly VITE_STORAGE_GDRIVE_CLIENT_ID?: string;
}
