import { render, screen } from '@testing-library/react';
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
        expect(screen.getByRole('heading', { name: /about renovation/i })).toBeInTheDocument();
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
