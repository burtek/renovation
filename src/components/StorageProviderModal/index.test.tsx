import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import StorageProviderModal from '.';


describe('StorageProviderModal', () => {
    const noop = async () => {
    };

    // ── Basic rendering ───────────────────────────────────────────────────

    it('renders the dialog with correct role and aria attributes', () => {
        render(
            <StorageProviderModal
                hasOptionalProviders={false}
                onSelectLocal={noop}
                onSelectGDrive={noop}
            />
        );
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('renders the "Choose Storage" heading', () => {
        render(
            <StorageProviderModal
                hasOptionalProviders={false}
                onSelectLocal={noop}
                onSelectGDrive={noop}
            />
        );
        expect(screen.getByRole('heading', { name: /choose storage/i })).toBeInTheDocument();
    });

    it('always shows the Local Storage button', () => {
        render(
            <StorageProviderModal
                hasOptionalProviders={false}
                onSelectLocal={noop}
                onSelectGDrive={noop}
            />
        );
        expect(screen.getByRole('button', { name: /local storage/i })).toBeInTheDocument();
    });

    it('shows the Google Drive button when hasOptionalProviders is true', () => {
        render(
            <StorageProviderModal
                hasOptionalProviders
                onSelectLocal={noop}
                onSelectGDrive={noop}
            />
        );
        expect(screen.getByRole('button', { name: /google drive/i })).toBeInTheDocument();
    });

    it('hides the Google Drive button when hasOptionalProviders is false', () => {
        render(
            <StorageProviderModal
                hasOptionalProviders={false}
                onSelectLocal={noop}
                onSelectGDrive={noop}
            />
        );
        expect(screen.queryByRole('button', { name: /google drive/i })).not.toBeInTheDocument();
    });

    // ── Local Storage selection ───────────────────────────────────────────

    it('calls onSelectLocal when the Local Storage button is clicked', async () => {
        const user = userEvent.setup();
        const onSelectLocal = vi.fn().mockResolvedValue(undefined);
        render(
            <StorageProviderModal
                hasOptionalProviders={false}
                onSelectLocal={onSelectLocal}
                onSelectGDrive={noop}
            />
        );

        await user.click(screen.getByRole('button', { name: /local storage/i }));

        await waitFor(() => {
            expect(onSelectLocal).toHaveBeenCalledOnce();
        });
    });

    it('disables both buttons while onSelectLocal is in-flight', async () => {
        const user = userEvent.setup();
        let resolve: () => void = () => {
        };
        const onSelectLocal = vi.fn(
            () => new Promise<void>(res => {
                resolve = res;
            })
        );

        render(
            <StorageProviderModal
                hasOptionalProviders
                onSelectLocal={onSelectLocal}
                onSelectGDrive={noop}
            />
        );

        await user.click(screen.getByRole('button', { name: /local storage/i }));

        // Both buttons should be disabled while the operation is pending
        expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /google drive/i })).toBeDisabled();

        // Cleanup: resolve the promise
        resolve();
    });

    it('shows "Loading…" on the Local Storage button while local is in-flight', async () => {
        const user = userEvent.setup();
        let resolve: () => void = () => {
        };
        const onSelectLocal = vi.fn(
            () => new Promise<void>(res => {
                resolve = res;
            })
        );

        render(
            <StorageProviderModal
                hasOptionalProviders
                onSelectLocal={onSelectLocal}
                onSelectGDrive={noop}
            />
        );

        await user.click(screen.getByRole('button', { name: /local storage/i }));

        expect(screen.getByText(/loading…/i)).toBeInTheDocument();
        // GDrive button should still say "Google Drive", not "Connecting…"
        expect(screen.queryByText(/connecting/i)).not.toBeInTheDocument();

        resolve();
    });

    // ── Google Drive selection ────────────────────────────────────────────

    it('calls onSelectGDrive when the Google Drive button is clicked', async () => {
        const user = userEvent.setup();
        const onSelectGDrive = vi.fn().mockResolvedValue(undefined);
        render(
            <StorageProviderModal
                hasOptionalProviders
                onSelectLocal={noop}
                onSelectGDrive={onSelectGDrive}
            />
        );

        await user.click(screen.getByRole('button', { name: /google drive/i }));

        await waitFor(() => {
            expect(onSelectGDrive).toHaveBeenCalledOnce();
        });
    });

    it('shows "Connecting…" label on the Google Drive button while gdrive is in-flight', async () => {
        const user = userEvent.setup();
        let resolve: () => void = () => {
        };
        const onSelectGDrive = vi.fn(
            () => new Promise<void>(res => {
                resolve = res;
            })
        );

        render(
            <StorageProviderModal
                hasOptionalProviders
                onSelectLocal={noop}
                onSelectGDrive={onSelectGDrive}
            />
        );

        await user.click(screen.getByRole('button', { name: /google drive/i }));

        expect(screen.getByText(/connecting/i)).toBeInTheDocument();
        // Local Storage button should still say "Local Storage", not "Loading…"
        expect(screen.queryByText(/loading…/i)).not.toBeInTheDocument();

        // Cleanup
        resolve();
    });

    it('disables both buttons while onSelectGDrive is in-flight', async () => {
        const user = userEvent.setup();
        let resolve: () => void = () => {
        };
        const onSelectGDrive = vi.fn(
            () => new Promise<void>(res => {
                resolve = res;
            })
        );

        render(
            <StorageProviderModal
                hasOptionalProviders
                onSelectLocal={noop}
                onSelectGDrive={onSelectGDrive}
            />
        );

        await user.click(screen.getByRole('button', { name: /google drive/i }));

        expect(screen.getByRole('button', { name: /local storage/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /connecting/i })).toBeDisabled();

        resolve();
    });

    // ── Error handling ────────────────────────────────────────────────────

    it('shows an error alert when onSelectGDrive rejects', async () => {
        const user = userEvent.setup();
        const onSelectGDrive = vi.fn().mockRejectedValue(new Error('OAuth cancelled'));
        render(
            <StorageProviderModal
                hasOptionalProviders
                onSelectLocal={noop}
                onSelectGDrive={onSelectGDrive}
            />
        );

        await user.click(screen.getByRole('button', { name: /google drive/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/OAuth cancelled/i);
        });
    });

    it('shows an error alert when onSelectLocal rejects', async () => {
        const user = userEvent.setup();
        const onSelectLocal = vi.fn().mockRejectedValue(new Error('Storage unavailable'));
        render(
            <StorageProviderModal
                hasOptionalProviders={false}
                onSelectLocal={onSelectLocal}
                onSelectGDrive={noop}
            />
        );

        await user.click(screen.getByRole('button', { name: /local storage/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/storage unavailable/i);
        });
    });

    it('shows a fallback error message when the rejection value is not an Error', async () => {
        const user = userEvent.setup();
        const onSelectGDrive = vi.fn().mockRejectedValue('raw string error');
        render(
            <StorageProviderModal
                hasOptionalProviders
                onSelectLocal={noop}
                onSelectGDrive={onSelectGDrive}
            />
        );

        await user.click(screen.getByRole('button', { name: /google drive/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });

    it('re-enables buttons after an error so the user can try again', async () => {
        const user = userEvent.setup();
        const onSelectGDrive = vi.fn().mockRejectedValue(new Error('popup closed'));
        render(
            <StorageProviderModal
                hasOptionalProviders
                onSelectLocal={noop}
                onSelectGDrive={onSelectGDrive}
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
        const onSelectGDrive = vi.fn()
            .mockRejectedValueOnce(new Error('first error'))
            .mockResolvedValueOnce(undefined);
        render(
            <StorageProviderModal
                hasOptionalProviders
                onSelectLocal={noop}
                onSelectGDrive={onSelectGDrive}
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

    it('moves focus to the Local Storage button on mount', () => {
        render(
            <StorageProviderModal
                hasOptionalProviders={false}
                onSelectLocal={noop}
                onSelectGDrive={noop}
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
                hasOptionalProviders
                onSelectLocal={noop}
                onSelectGDrive={noop}
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
                hasOptionalProviders
                onSelectLocal={noop}
                onSelectGDrive={noop}
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
                hasOptionalProviders
                onSelectLocal={noop}
                onSelectGDrive={noop}
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
                hasOptionalProviders
                onSelectLocal={noop}
                onSelectGDrive={noop}
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
                hasOptionalProviders
                onSelectLocal={noop}
                onSelectGDrive={noop}
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

    it('shows a fallback error message when onSelectLocal rejects with a non-Error value', async () => {
        const user = userEvent.setup();
        const onSelectLocal = vi.fn().mockRejectedValue('storage unavailable string');
        render(
            <StorageProviderModal
                hasOptionalProviders={false}
                onSelectLocal={onSelectLocal}
                onSelectGDrive={noop}
            />
        );

        await user.click(screen.getByRole('button', { name: /local storage/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Failed to initialize local storage.');
        });
    });

    // ── providersReady loading state ─────────────────────────────────────────

    it('disables the Google Drive button and shows "Loading…" when providersReady is false', () => {
        render(
            <StorageProviderModal
                hasOptionalProviders
                providersReady={false}
                onSelectLocal={noop}
                onSelectGDrive={noop}
            />
        );
        const gdriveBtn = screen.getByRole('button', { name: /loading…/i });
        expect(gdriveBtn).toBeDisabled();
    });

    it('enables the Google Drive button and shows "Google Drive" when providersReady is true', () => {
        render(
            <StorageProviderModal
                hasOptionalProviders
                providersReady
                onSelectLocal={noop}
                onSelectGDrive={noop}
            />
        );
        const gdriveBtn = screen.getByRole('button', { name: /google drive/i });
        expect(gdriveBtn).not.toBeDisabled();
    });

    it('does not call onSelectGDrive when providersReady is false and the button is clicked', async () => {
        const user = userEvent.setup();
        const onSelectGDrive = vi.fn().mockResolvedValue(undefined);
        render(
            <StorageProviderModal
                hasOptionalProviders
                providersReady={false}
                onSelectLocal={noop}
                onSelectGDrive={onSelectGDrive}
            />
        );
        // The button is disabled, so clicking it should not trigger the handler
        const gdriveBtn = screen.getByRole('button', { name: /loading…/i });
        await user.click(gdriveBtn);
        expect(onSelectGDrive).not.toHaveBeenCalled();
    });
});
