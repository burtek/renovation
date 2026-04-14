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
                gdriveAvailable={false}
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
                gdriveAvailable={false}
                onSelectLocal={noop}
                onSelectGDrive={noop}
            />
        );
        expect(screen.getByRole('heading', { name: /choose storage/i })).toBeInTheDocument();
    });

    it('always shows the Local Storage button', () => {
        render(
            <StorageProviderModal
                gdriveAvailable={false}
                onSelectLocal={noop}
                onSelectGDrive={noop}
            />
        );
        expect(screen.getByRole('button', { name: /local storage/i })).toBeInTheDocument();
    });

    it('shows the Google Drive button when gdriveAvailable is true', () => {
        render(
            <StorageProviderModal
                gdriveAvailable
                onSelectLocal={noop}
                onSelectGDrive={noop}
            />
        );
        expect(screen.getByRole('button', { name: /google drive/i })).toBeInTheDocument();
    });

    it('hides the Google Drive button when gdriveAvailable is false', () => {
        render(
            <StorageProviderModal
                gdriveAvailable={false}
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
                gdriveAvailable={false}
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
                gdriveAvailable
                onSelectLocal={onSelectLocal}
                onSelectGDrive={noop}
            />
        );

        await user.click(screen.getByRole('button', { name: /local storage/i }));

        // Both buttons should be disabled while the operation is pending
        expect(screen.getByRole('button', { name: /local storage/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /google drive|connecting/i })).toBeDisabled();

        // Cleanup: resolve the promise
        resolve();
    });

    // ── Google Drive selection ────────────────────────────────────────────

    it('calls onSelectGDrive when the Google Drive button is clicked', async () => {
        const user = userEvent.setup();
        const onSelectGDrive = vi.fn().mockResolvedValue(undefined);
        render(
            <StorageProviderModal
                gdriveAvailable
                onSelectLocal={noop}
                onSelectGDrive={onSelectGDrive}
            />
        );

        await user.click(screen.getByRole('button', { name: /google drive/i }));

        await waitFor(() => {
            expect(onSelectGDrive).toHaveBeenCalledOnce();
        });
    });

    it('shows "Connecting…" label on the Google Drive button while loading', async () => {
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
                gdriveAvailable
                onSelectLocal={noop}
                onSelectGDrive={onSelectGDrive}
            />
        );

        await user.click(screen.getByRole('button', { name: /google drive/i }));

        expect(screen.getByText(/connecting/i)).toBeInTheDocument();

        // Cleanup
        resolve();
    });

    // ── Error handling ────────────────────────────────────────────────────

    it('shows an error alert when onSelectGDrive rejects', async () => {
        const user = userEvent.setup();
        const onSelectGDrive = vi.fn().mockRejectedValue(new Error('OAuth cancelled'));
        render(
            <StorageProviderModal
                gdriveAvailable
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
                gdriveAvailable={false}
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
                gdriveAvailable
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
                gdriveAvailable
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
});
