import type { KeyboardEvent } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

import { cn } from '../../utils/classnames';


interface StorageProviderModalProps {
    hasOptionalProviders: boolean;
    providersReady?: boolean;
    onSelectLocal: () => Promise<void>;
    onSelectGDrive: () => Promise<void>;
}

export default function StorageProviderModal({
    hasOptionalProviders,
    providersReady = true,
    onSelectLocal,
    onSelectGDrive
}: StorageProviderModalProps) {
    const titleId = useId();
    const dialogRef = useRef<HTMLDivElement>(null);
    const firstButtonRef = useRef<HTMLButtonElement>(null);
    const [loadingProvider, setLoadingProvider] = useState<'local' | 'gdrive' | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isLoading = loadingProvider !== null;
    const gdriveButtonLabel = (() => {
        if (loadingProvider === 'gdrive') {
            return 'Connecting…';
        }
        if (!providersReady) {
            return 'Loading…';
        }
        return 'Google Drive';
    })();

    // Focus the first button when the modal mounts
    useEffect(() => {
        firstButtonRef.current?.focus();
    }, []);

    // Keep Tab / Shift+Tab focus within the dialog
    const handleTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== 'Tab') {
            return;
        }
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        /* c8 ignore next -- the dialog always has at least one focusable button */
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

    const handleLocal = async () => {
        setLoadingProvider('local');
        setError(null);
        try {
            await onSelectLocal();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to initialize local storage.');
            setLoadingProvider(null);
        }
    };

    const handleGDrive = async () => {
        setLoadingProvider('gdrive');
        setError(null);
        try {
            await onSelectGDrive();
        } catch (err: unknown) {
            setError(
                err instanceof Error ? err.message : 'Failed to connect to Google Drive. Please try again.'
            );
            setLoadingProvider(null);
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
                    className="text-xl font-bold mb-2"
                >
                    🏠 Choose Storage
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    Where would you like to store your projects? Your choice is not remembered — you
                    will be asked again on the next visit.
                </p>

                <div className="space-y-3">
                    <button
                        ref={firstButtonRef}
                        type="button"
                        disabled={isLoading}
                        onClick={() => {
                            void handleLocal();
                        }}
                        className={cn(
                            'w-full flex items-center gap-4 px-5 py-4 rounded-lg border-2 text-left transition',
                            'border-gray-300 dark:border-gray-600',
                            'hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20',
                            'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                    >
                        <span className="text-2xl">💾</span>
                        <div>
                            <div className="font-semibold">
                                {loadingProvider === 'local' ? 'Loading…' : 'Local Storage'}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                Store projects in your browser (OPFS / localStorage)
                            </div>
                        </div>
                    </button>

                    {hasOptionalProviders && (
                        <button
                            type="button"
                            disabled={isLoading || !providersReady}
                            onClick={() => {
                                void handleGDrive();
                            }}
                            className={cn(
                                'w-full flex items-center gap-4 px-5 py-4 rounded-lg border-2 text-left transition',
                                'border-gray-300 dark:border-gray-600',
                                'hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20',
                                'disabled:opacity-50 disabled:cursor-not-allowed'
                            )}
                        >
                            <span className="text-2xl">☁️</span>
                            <div>
                                <div className="font-semibold">
                                    {gdriveButtonLabel}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                    Store projects in your Google Drive (app data only)
                                </div>
                            </div>
                        </button>
                    )}
                </div>

                {error && (
                    <p
                        role="alert"
                        className="mt-4 text-sm text-red-600 dark:text-red-400"
                    >
                        {error}
                    </p>
                )}
            </div>
        </div>
    );
}
