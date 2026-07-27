import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ProviderOption } from '../../storage';

import StorageProviderModal from '.';


describe('StorageProviderModal', () => {
    const noop = async () => {
    };

    // ── Test fixtures ─────────────────────────────────────────────────────

    const localProvider: ProviderOption = {
        providerId: 'LS_OPFS',
        name: 'Local Storage',
        description: 'Store projects in your browser (OPFS / localStorage)',
        icon: '💾',
        ready: true
    };
    const gdriveProvider: ProviderOption = {
        providerId: 'GDRIVE',
        name: 'Google Drive',
        description: 'Store projects in your Google Drive (app data only)',
        icon: '☁️',
        ready: true,
        inFlightLabel: 'Connecting…'
    };
    const gdriveProviderNotReady: ProviderOption = { ...gdriveProvider, ready: false };

    // ── Basic rendering ───────────────────────────────────────────────────

    it('renders the dialog with correct role and aria attributes', () => {
        render(
            <StorageProviderModal
                availableProviders={[localProvider]}
                onSelectProvider={noop}
            />
        );
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('renders the "Choose Storage" heading', () => {
        render(
            <StorageProviderModal
                availableProviders={[localProvider]}
                onSelectProvider={noop}
            />
        );
        expect(screen.getByRole('heading', { name: /choose storage/i })).toBeInTheDocument();
    });

    it('renders a button for each provider in availableProviders', () => {
        render(
            <StorageProviderModal
                availableProviders={[localProvider]}
                onSelectProvider={noop}
            />
        );
        expect(screen.getByRole('button', { name: /local storage/i })).toBeInTheDocument();
    });

    it('shows the Google Drive button when it is in availableProviders', () => {
        render(
            <StorageProviderModal
                availableProviders={[localProvider, gdriveProvider]}
                onSelectProvider={noop}
            />
        );
        expect(screen.getByRole('button', { name: /google drive/i })).toBeInTheDocument();
    });

    it('does not show the Google Drive button when it is not in availableProviders', () => {
        render(
            <StorageProviderModal
                availableProviders={[localProvider]}
                onSelectProvider={noop}
            />
        );
        expect(screen.queryByRole('button', { name: /google drive/i })).not.toBeInTheDocument();
    });

    // ── Provider selection ────────────────────────────────────────────────

    it('calls onSelectProvider with the local provider id when the Local Storage button is clicked', async () => {
        const user = userEvent.setup();
        const onSelectProvider = vi.fn().mockResolvedValue(undefined);
        render(
            <StorageProviderModal
                availableProviders={[localProvider]}
                onSelectProvider={onSelectProvider}
            />
        );

        await user.click(screen.getByRole('button', { name: /local storage/i }));

        await waitFor(() => {
            expect(onSelectProvider).toHaveBeenCalledOnce();
            expect(onSelectProvider).toHaveBeenCalledWith('LS_OPFS');
        });
    });

    it('disables all buttons while a selection is in-flight', async () => {
        const user = userEvent.setup();
        let resolve: () => void = () => {
        };
        const onSelectProvider = vi.fn(
            () => new Promise<void>(res => {
                resolve = res;
            })
        );

        render(
            <StorageProviderModal
                availableProviders={[localProvider, gdriveProvider]}
                onSelectProvider={onSelectProvider}
            />
        );

        await user.click(screen.getByRole('button', { name: /local storage/i }));

        // Both buttons should be disabled while the operation is pending
        expect(screen.getByRole('button', { name: /local storage.*loading/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /google drive/i })).toBeDisabled();

        // Cleanup: resolve the promise
        resolve();
    });

    it('shows "{name} (loading)" on the selected button (no inFlightLabel) while in-flight', async () => {
        const user = userEvent.setup();
        let resolve: () => void = () => {
        };
        const onSelectProvider = vi.fn(
            () => new Promise<void>(res => {
                resolve = res;
            })
        );

        render(
            <StorageProviderModal
                availableProviders={[localProvider, gdriveProvider]}
                onSelectProvider={onSelectProvider}
            />
        );

        await user.click(screen.getByRole('button', { name: /local storage/i }));

        expect(screen.getByText(/local storage \(loading\)/i)).toBeInTheDocument();
        // GDrive button should still say "Google Drive", not "Connecting…"
        expect(screen.queryByText(/connecting/i)).not.toBeInTheDocument();

        resolve();
    });

    // ── Google Drive selection ────────────────────────────────────────────

    it('calls onSelectProvider with the gdrive id when the Google Drive button is clicked', async () => {
        const user = userEvent.setup();
        const onSelectProvider = vi.fn().mockResolvedValue(undefined);
        render(
            <StorageProviderModal
                availableProviders={[localProvider, gdriveProvider]}
                onSelectProvider={onSelectProvider}
            />
        );

        await user.click(screen.getByRole('button', { name: /google drive/i }));

        await waitFor(() => {
            expect(onSelectProvider).toHaveBeenCalledOnce();
            expect(onSelectProvider).toHaveBeenCalledWith('GDRIVE');
        });
    });

    it('shows the inFlightLabel on the Google Drive button while gdrive is in-flight', async () => {
        const user = userEvent.setup();
        let resolve: () => void = () => {
        };
        const onSelectProvider = vi.fn(
            () => new Promise<void>(res => {
                resolve = res;
            })
        );

        render(
            <StorageProviderModal
                availableProviders={[localProvider, gdriveProvider]}
                onSelectProvider={onSelectProvider}
            />
        );

        await user.click(screen.getByRole('button', { name: /google drive/i }));

        expect(screen.getByText(/connecting/i)).toBeInTheDocument();
        // Local Storage button should still say "Local Storage", not "Loading…"
        expect(screen.queryByText(/loading…/i)).not.toBeInTheDocument();

        // Cleanup
        resolve();
    });

    it('disables all buttons while onSelectProvider is in-flight for gdrive', async () => {
        const user = userEvent.setup();
        let resolve: () => void = () => {
        };
        const onSelectProvider = vi.fn(
            () => new Promise<void>(res => {
                resolve = res;
            })
        );

        render(
            <StorageProviderModal
                availableProviders={[localProvider, gdriveProvider]}
                onSelectProvider={onSelectProvider}
            />
        );

        await user.click(screen.getByRole('button', { name: /google drive/i }));

        expect(screen.getByRole('button', { name: /local storage/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /connecting/i })).toBeDisabled();

        resolve();
    });

    // ── Error handling ────────────────────────────────────────────────────

    it('shows an error alert when onSelectProvider rejects with an Error', async () => {
        const user = userEvent.setup();
        const onSelectProvider = vi.fn().mockRejectedValue(new Error('OAuth cancelled'));
        render(
            <StorageProviderModal
                availableProviders={[localProvider, gdriveProvider]}
                onSelectProvider={onSelectProvider}
            />
        );

        await user.click(screen.getByRole('button', { name: /google drive/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/OAuth cancelled/i);
        });
    });

    it('shows an error alert when onSelectProvider rejects for the local button', async () => {
        const user = userEvent.setup();
        const onSelectProvider = vi.fn().mockRejectedValue(new Error('Storage unavailable'));
        render(
            <StorageProviderModal
                availableProviders={[localProvider]}
                onSelectProvider={onSelectProvider}
            />
        );

        await user.click(screen.getByRole('button', { name: /local storage/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/storage unavailable/i);
        });
    });

    it('shows a fallback error message when the rejection value is not an Error', async () => {
        const user = userEvent.setup();
        const onSelectProvider = vi.fn().mockRejectedValue('raw string error');
        render(
            <StorageProviderModal
                availableProviders={[localProvider, gdriveProvider]}
                onSelectProvider={onSelectProvider}
            />
        );

        await user.click(screen.getByRole('button', { name: /google drive/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });

    it('re-enables buttons after an error so the user can try again', async () => {
        const user = userEvent.setup();
        const onSelectProvider = vi.fn().mockRejectedValue(new Error('popup closed'));
        render(
            <StorageProviderModal
                availableProviders={[localProvider, gdriveProvider]}
                onSelectProvider={onSelectProvider}
            />
        );

        await user.click(screen.getByRole('button', { name: /google drive/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        expect(screen.getByRole('button', { name: /local storage/i })).not.toBeDisabled();
        expect(screen.getByRole('button', { name: /google drive/i })).not.toBeDisabled();
    });

    it('clears the previous error when a new action is started', async () => {
        const user = userEvent.setup();
        // First click fails
        const onSelectProvider = vi.fn()
            .mockRejectedValueOnce(new Error('first error'))
            .mockResolvedValueOnce(undefined);
        render(
            <StorageProviderModal
                availableProviders={[localProvider, gdriveProvider]}
                onSelectProvider={onSelectProvider}
            />
        );

        await user.click(screen.getByRole('button', { name: /google drive/i }));
        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('first error');
        });

        // Second click should clear the error immediately
        await user.click(screen.getByRole('button', { name: /google drive/i }));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    // ── Initial focus ─────────────────────────────────────────────────────

    it('moves focus to the first button on mount', () => {
        render(
            <StorageProviderModal
                availableProviders={[localProvider]}
                onSelectProvider={noop}
            />
        );
        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: /local storage/i })
        );
    });

    // ── Tab focus trap ────────────────────────────────────────────────────

    it('wraps Tab focus from the last button back to the first', async () => {
        const user = userEvent.setup();
        render(
            <StorageProviderModal
                availableProviders={[localProvider, gdriveProvider]}
                onSelectProvider={noop}
            />
        );
        const localBtn = screen.getByRole('button', { name: /local storage/i });
        const gdriveBtn = screen.getByRole('button', { name: /google drive/i });

        gdriveBtn.focus();
        expect(document.activeElement).toBe(gdriveBtn);

        await user.tab();

        await waitFor(() => {
            expect(document.activeElement).toBe(localBtn);
        });
    });

    it('wraps Shift+Tab focus from the first button back to the last', async () => {
        const user = userEvent.setup();
        render(
            <StorageProviderModal
                availableProviders={[localProvider, gdriveProvider]}
                onSelectProvider={noop}
            />
        );
        const localBtn = screen.getByRole('button', { name: /local storage/i });
        const gdriveBtn = screen.getByRole('button', { name: /google drive/i });

        localBtn.focus();
        expect(document.activeElement).toBe(localBtn);

        await user.tab({ shift: true });

        await waitFor(() => {
            expect(document.activeElement).toBe(gdriveBtn);
        });
    });

    it('ignores non-Tab keydown events in the focus trap handler', async () => {
        const user = userEvent.setup();
        render(
            <StorageProviderModal
                availableProviders={[localProvider, gdriveProvider]}
                onSelectProvider={noop}
            />
        );
        const localBtn = screen.getByRole('button', { name: /local storage/i });
        localBtn.focus();

        await user.keyboard('{ArrowDown}');
        expect(document.activeElement).toBe(localBtn);
    });

    it('does not wrap Tab focus when not on the last element', async () => {
        const user = userEvent.setup();
        render(
            <StorageProviderModal
                availableProviders={[localProvider, gdriveProvider]}
                onSelectProvider={noop}
            />
        );
        const localBtn = screen.getByRole('button', { name: /local storage/i });
        const gdriveBtn = screen.getByRole('button', { name: /google drive/i });

        localBtn.focus();
        expect(document.activeElement).toBe(localBtn);

        // Tab from the first button should move naturally to the second (no wrap)
        await user.tab();

        await waitFor(() => {
            expect(document.activeElement).toBe(gdriveBtn);
        });
    });

    it('does not wrap Shift+Tab focus when not on the first element', async () => {
        const user = userEvent.setup();
        render(
            <StorageProviderModal
                availableProviders={[localProvider, gdriveProvider]}
                onSelectProvider={noop}
            />
        );
        const localBtn = screen.getByRole('button', { name: /local storage/i });
        const gdriveBtn = screen.getByRole('button', { name: /google drive/i });

        gdriveBtn.focus();
        expect(document.activeElement).toBe(gdriveBtn);

        // Shift+Tab from the last button should move naturally to the first (no wrap)
        await user.tab({ shift: true });

        await waitFor(() => {
            expect(document.activeElement).toBe(localBtn);
        });
    });

    it('shows a fallback error message when onSelectProvider rejects with a non-Error value for local', async () => {
        const user = userEvent.setup();
        const onSelectProvider = vi.fn().mockRejectedValue('storage unavailable string');
        render(
            <StorageProviderModal
                availableProviders={[localProvider]}
                onSelectProvider={onSelectProvider}
            />
        );

        await user.click(screen.getByRole('button', { name: /local storage/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(
                'Failed to select storage provider. Please try again.'
            );
        });
    });

    // ── ready flag loading state ──────────────────────────────────────────

    it('disables the Google Drive button and shows "Google Drive (loading)" when ready is false', () => {
        render(
            <StorageProviderModal
                availableProviders={[localProvider, gdriveProviderNotReady]}
                onSelectProvider={noop}
            />
        );
        const gdriveBtn = screen.getByRole('button', { name: /google drive.*loading/i });
        expect(gdriveBtn).toBeDisabled();
    });

    it('enables the Google Drive button and shows "Google Drive" when ready is true', () => {
        render(
            <StorageProviderModal
                availableProviders={[localProvider, gdriveProvider]}
                onSelectProvider={noop}
            />
        );
        const gdriveBtn = screen.getByRole('button', { name: /google drive/i });
        expect(gdriveBtn).not.toBeDisabled();
    });

    it('does not call onSelectProvider when a not-ready button is clicked', async () => {
        const user = userEvent.setup();
        const onSelectProvider = vi.fn().mockResolvedValue(undefined);
        render(
            <StorageProviderModal
                availableProviders={[localProvider, gdriveProviderNotReady]}
                onSelectProvider={onSelectProvider}
            />
        );
        // The button is disabled, so clicking it should not trigger the handler
        const gdriveBtn = screen.getByRole('button', { name: /google drive.*loading/i });
        await user.click(gdriveBtn);
        expect(onSelectProvider).not.toHaveBeenCalled();
    });
});
