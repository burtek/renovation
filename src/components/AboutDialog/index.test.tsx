import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import AboutDialog from '.';


describe('AboutDialog', () => {
    // ── Visibility ────────────────────────────────────────────────────────

    it('renders nothing when isOpen is false', () => {
        const { container } = render(
            <AboutDialog
                isOpen={false}
                onClose={vi.fn()}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders the dialog when isOpen is true', () => {
        render(
            <AboutDialog
                isOpen
                onClose={vi.fn()}
            />
        );
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /about renovation/i })).toBeInTheDocument();
    });

    // ── ARIA semantics ────────────────────────────────────────────────────

    it('has role="dialog" and aria-modal="true" on the panel', () => {
        render(
            <AboutDialog
                isOpen
                onClose={vi.fn()}
            />
        );
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby pointing to the dialog title', () => {
        render(
            <AboutDialog
                isOpen
                onClose={vi.fn()}
            />
        );
        const dialog = screen.getByRole('dialog');
        const labelId = dialog.getAttribute('aria-labelledby');
        expect(labelId).toBeTruthy();
        const title = document.getElementById(labelId!);
        expect(title).toBeInTheDocument();
        expect(title).toHaveTextContent(/about renovation/i);
    });

    // ── Content ───────────────────────────────────────────────────────────

    it('shows the app description', () => {
        render(
            <AboutDialog
                isOpen
                onClose={vi.fn()}
            />
        );
        expect(screen.getByText(/web-based project management application/i)).toBeInTheDocument();
    });

    it('mentions all four feature sections', () => {
        render(
            <AboutDialog
                isOpen
                onClose={vi.fn()}
            />
        );
        expect(screen.getAllByText(/notes/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/tasks/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/finance/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/calendar/i).length).toBeGreaterThan(0);
    });

    it('includes the AI-created notice', () => {
        render(
            <AboutDialog
                isOpen
                onClose={vi.fn()}
            />
        );
        expect(screen.getByText(/fully created by ai/i)).toBeInTheDocument();
    });

    // ── Focus management ──────────────────────────────────────────────────

    it('moves focus to the close button when the dialog opens', () => {
        render(
            <AboutDialog
                isOpen
                onClose={vi.fn()}
            />
        );
        expect(document.activeElement).toBe(screen.getByRole('button', { name: /close/i }));
    });

    // ── Close button ──────────────────────────────────────────────────────

    it('renders a close button with accessible label', () => {
        render(
            <AboutDialog
                isOpen
                onClose={vi.fn()}
            />
        );
        expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });

    it('calls onClose when the close button is clicked', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <AboutDialog
                isOpen
                onClose={onClose}
            />
        );

        await user.click(screen.getByRole('button', { name: /close/i }));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    // ── Keyboard ──────────────────────────────────────────────────────────

    it('calls onClose when Escape is pressed', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <AboutDialog
                isOpen
                onClose={onClose}
            />
        );

        await user.keyboard('{Escape}');

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not add Escape listener when dialog is closed', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <AboutDialog
                isOpen={false}
                onClose={onClose}
            />
        );

        await user.keyboard('{Escape}');

        expect(onClose).not.toHaveBeenCalled();
    });

    // ── Focus trap ────────────────────────────────────────────────────────

    it('traps Tab focus: Tab on last focusable element wraps to first', () => {
        render(
            <AboutDialog
                isOpen
                onClose={vi.fn()}
            />
        );
        const dialog = screen.getByRole('dialog');
        const closeButton = screen.getByRole('button', { name: /close/i });

        // Close button is the only (and therefore last) focusable element
        closeButton.focus();
        fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: false });

        expect(document.activeElement).toBe(closeButton);
    });

    it('traps Tab focus: Shift+Tab on first focusable element wraps to last', () => {
        render(
            <AboutDialog
                isOpen
                onClose={vi.fn()}
            />
        );
        const dialog = screen.getByRole('dialog');
        const closeButton = screen.getByRole('button', { name: /close/i });

        // Close button is the only (and therefore first) focusable element
        closeButton.focus();
        fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });

        expect(document.activeElement).toBe(closeButton);
    });

    it('does not intercept non-Tab keys pressed on the dialog panel', () => {
        const onClose = vi.fn();
        render(
            <AboutDialog
                isOpen
                onClose={onClose}
            />
        );
        const dialog = screen.getByRole('dialog');

        fireEvent.keyDown(dialog, { key: ' ' });

        expect(onClose).not.toHaveBeenCalled();
    });

    it('does not wrap Tab focus when active element is not the last focusable element', () => {
        render(
            <AboutDialog
                isOpen
                onClose={vi.fn()}
            />
        );
        const dialog = screen.getByRole('dialog');
        const closeButton = screen.getByRole('button', { name: /close/i });

        // Blur the close button so focus is on body (not the last element)
        closeButton.blur();
        fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: false });

        // Focus should NOT have wrapped to close button
        expect(document.activeElement).not.toBe(closeButton);
    });

    it('does not wrap Shift+Tab focus when active element is not the first focusable element', () => {
        render(
            <AboutDialog
                isOpen
                onClose={vi.fn()}
            />
        );
        const dialog = screen.getByRole('dialog');
        const closeButton = screen.getByRole('button', { name: /close/i });

        // Blur the close button so focus is on body (not the first element)
        closeButton.blur();
        fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });

        // Focus should NOT have wrapped to close button
        expect(document.activeElement).not.toBe(closeButton);
    });

    // ── Backdrop ──────────────────────────────────────────────────────────

    it('calls onClose when the backdrop is clicked', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        const { container } = render(
            <AboutDialog
                isOpen
                onClose={onClose}
            />
        );

        // The outermost div is the backdrop
        const backdrop = container.firstChild as HTMLElement;
        await user.click(backdrop);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when the dialog panel itself is clicked', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <AboutDialog
                isOpen
                onClose={onClose}
            />
        );

        // Click the heading (inside the panel) — should NOT propagate to backdrop
        await user.click(screen.getByRole('heading', { name: /about renovation/i }));

        expect(onClose).not.toHaveBeenCalled();
    });
});
