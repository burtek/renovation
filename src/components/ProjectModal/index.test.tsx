import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ProjectModal from '.';


const PROJECTS = [
    { id: 'p1', name: 'Kitchen Reno', lastModified: '2024-06-01T10:00:00.000Z' },
    { id: 'p2', name: 'Bathroom', lastModified: '2024-01-01T10:00:00.000Z' }
];

describe('ProjectModal', () => {
    // ── With no existing projects ─────────────────────────────────────────

    describe('when there are no existing projects', () => {
        it('shows the "No projects yet" message', () => {
            render(
                <ProjectModal
                    projects={[]}
                    onSelect={vi.fn()}
                    onCreate={vi.fn()}
                />
            );
            expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
        });

        it('does not show the "Select an existing project" section', () => {
            render(
                <ProjectModal
                    projects={[]}
                    onSelect={vi.fn()}
                    onCreate={vi.fn()}
                />
            );
            expect(screen.queryByText(/select an existing project/i)).not.toBeInTheDocument();
        });

        it('does not show the "Cancel" button when there are no projects', () => {
            render(
                <ProjectModal
                    projects={[]}
                    onSelect={vi.fn()}
                    onCreate={vi.fn()}
                />
            );
            expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
        });

        it('shows the project name input', () => {
            render(
                <ProjectModal
                    projects={[]}
                    onSelect={vi.fn()}
                    onCreate={vi.fn()}
                />
            );
            expect(screen.getByRole('textbox')).toBeInTheDocument();
        });

        it('shows validation error when submitting with empty name', async () => {
            const user = userEvent.setup();
            render(
                <ProjectModal
                    projects={[]}
                    onSelect={vi.fn()}
                    onCreate={vi.fn()}
                />
            );

            await user.click(screen.getByRole('button', { name: /create project/i }));

            expect(screen.getByText(/please enter a project name/i)).toBeInTheDocument();
        });

        it('calls onCreate with the trimmed name on form submit', async () => {
            const user = userEvent.setup();
            const onCreate = vi.fn();
            render(
                <ProjectModal
                    projects={[]}
                    onSelect={vi.fn()}
                    onCreate={onCreate}
                />
            );

            await user.type(screen.getByRole('textbox'), '  My New Project  ');
            await user.click(screen.getByRole('button', { name: /create project/i }));

            expect(onCreate).toHaveBeenCalledWith('My New Project');
        });

        it('clears the validation error when user starts typing', async () => {
            const user = userEvent.setup();
            render(
                <ProjectModal
                    projects={[]}
                    onSelect={vi.fn()}
                    onCreate={vi.fn()}
                />
            );

            await user.click(screen.getByRole('button', { name: /create project/i }));
            expect(screen.getByText(/please enter a project name/i)).toBeInTheDocument();

            await user.type(screen.getByRole('textbox'), 'a');
            expect(screen.queryByText(/please enter a project name/i)).not.toBeInTheDocument();
        });
    });

    // ── With existing projects ────────────────────────────────────────────

    describe('when there are existing projects', () => {
        it('shows the list of projects', () => {
            render(
                <ProjectModal
                    projects={PROJECTS}
                    onSelect={vi.fn()}
                    onCreate={vi.fn()}
                />
            );
            expect(screen.getByText('Kitchen Reno')).toBeInTheDocument();
            expect(screen.getByText('Bathroom')).toBeInTheDocument();
        });

        it('shows "Select an existing project" label', () => {
            render(
                <ProjectModal
                    projects={PROJECTS}
                    onSelect={vi.fn()}
                    onCreate={vi.fn()}
                />
            );
            expect(screen.getByText(/select an existing project/i)).toBeInTheDocument();
        });

        it('shows lastModified formatted date for each project', () => {
            render(
                <ProjectModal
                    projects={PROJECTS}
                    onSelect={vi.fn()}
                    onCreate={vi.fn()}
                />
            );
            // Both entries show "Last saved:" prefix
            const lastSavedLabels = screen.getAllByText(/last saved/i);
            expect(lastSavedLabels.length).toBeGreaterThanOrEqual(2);
        });

        it('calls onSelect with the project id when clicking a project', async () => {
            const user = userEvent.setup();
            const onSelect = vi.fn();
            render(
                <ProjectModal
                    projects={PROJECTS}
                    onSelect={onSelect}
                    onCreate={vi.fn()}
                />
            );

            await user.click(screen.getByText('Kitchen Reno'));
            expect(onSelect).toHaveBeenCalledWith('p1');
        });

        it('does not show the new project form by default', () => {
            render(
                <ProjectModal
                    projects={PROJECTS}
                    onSelect={vi.fn()}
                    onCreate={vi.fn()}
                />
            );
            expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        });

        it('shows the "+ New Project" button', () => {
            render(
                <ProjectModal
                    projects={PROJECTS}
                    onSelect={vi.fn()}
                    onCreate={vi.fn()}
                />
            );
            expect(screen.getByRole('button', { name: /\+ new project/i })).toBeInTheDocument();
        });

        it('shows the new project form after clicking "+ New Project"', async () => {
            const user = userEvent.setup();
            render(
                <ProjectModal
                    projects={PROJECTS}
                    onSelect={vi.fn()}
                    onCreate={vi.fn()}
                />
            );

            await user.click(screen.getByRole('button', { name: /\+ new project/i }));

            expect(screen.getByRole('textbox')).toBeInTheDocument();
        });

        it('hides "+ New Project" button after it is clicked', async () => {
            const user = userEvent.setup();
            render(
                <ProjectModal
                    projects={PROJECTS}
                    onSelect={vi.fn()}
                    onCreate={vi.fn()}
                />
            );

            await user.click(screen.getByRole('button', { name: /\+ new project/i }));

            expect(screen.queryByRole('button', { name: /\+ new project/i })).not.toBeInTheDocument();
        });

        it('shows Cancel button when new project form is open with existing projects', async () => {
            const user = userEvent.setup();
            render(
                <ProjectModal
                    projects={PROJECTS}
                    onSelect={vi.fn()}
                    onCreate={vi.fn()}
                />
            );

            await user.click(screen.getByRole('button', { name: /\+ new project/i }));

            expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
        });

        it('hides the new project form when Cancel is clicked', async () => {
            const user = userEvent.setup();
            render(
                <ProjectModal
                    projects={PROJECTS}
                    onSelect={vi.fn()}
                    onCreate={vi.fn()}
                />
            );

            await user.click(screen.getByRole('button', { name: /\+ new project/i }));
            await user.click(screen.getByRole('button', { name: /cancel/i }));

            expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        });

        it('resets the name input and error when Cancel is clicked', async () => {
            const user = userEvent.setup();
            render(
                <ProjectModal
                    projects={PROJECTS}
                    onSelect={vi.fn()}
                    onCreate={vi.fn()}
                />
            );

            await user.click(screen.getByRole('button', { name: /\+ new project/i }));
            await user.click(screen.getByRole('button', { name: /create project/i })); // trigger error
            expect(screen.getByText(/please enter a project name/i)).toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: /cancel/i }));

            // Re-open — error should be gone
            await user.click(screen.getByRole('button', { name: /\+ new project/i }));
            expect(screen.queryByText(/please enter a project name/i)).not.toBeInTheDocument();
        });

        it('calls onCreate with the trimmed name when form is submitted with existing projects', async () => {
            const user = userEvent.setup();
            const onCreate = vi.fn();
            render(
                <ProjectModal
                    projects={PROJECTS}
                    onSelect={vi.fn()}
                    onCreate={onCreate}
                />
            );

            await user.click(screen.getByRole('button', { name: /\+ new project/i }));
            await user.type(screen.getByRole('textbox'), 'New Kitchen');
            await user.click(screen.getByRole('button', { name: /create project/i }));

            expect(onCreate).toHaveBeenCalledWith('New Kitchen');
        });
    });

    // ── Accessibility ─────────────────────────────────────────────────────

    it('has role="dialog" and aria-modal="true"', () => {
        render(
            <ProjectModal
                projects={[]}
                onSelect={vi.fn()}
                onCreate={vi.fn()}
            />
        );
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('has an accessible heading "🏠 Open Project"', () => {
        render(
            <ProjectModal
                projects={[]}
                onSelect={vi.fn()}
                onCreate={vi.fn()}
            />
        );
        expect(screen.getByRole('heading', { name: /open project/i })).toBeInTheDocument();
    });

    // ── Tab focus trap ────────────────────────────────────────────────────

    it('wraps Tab focus back to first element when on last focusable element', async () => {
        const user = userEvent.setup();
        render(
            <ProjectModal
                projects={[]}
                onSelect={vi.fn()}
                onCreate={vi.fn()}
            />
        );

        // The dialog has: input (text) + Create Project button
        const input = screen.getByRole('textbox');
        const createBtn = screen.getByRole('button', { name: /create project/i });

        createBtn.focus();
        expect(document.activeElement).toBe(createBtn);

        await user.tab();

        // Focus should wrap back to first element
        await waitFor(() => {
            expect(document.activeElement).toBe(input);
        });
    });

    it('wraps Shift+Tab focus back to last element when on first focusable element', async () => {
        const user = userEvent.setup();
        render(
            <ProjectModal
                projects={[]}
                onSelect={vi.fn()}
                onCreate={vi.fn()}
            />
        );

        const input = screen.getByRole('textbox');
        const createBtn = screen.getByRole('button', { name: /create project/i });

        input.focus();
        expect(document.activeElement).toBe(input);

        await user.tab({ shift: true });

        await waitFor(() => {
            expect(document.activeElement).toBe(createBtn);
        });
    });

    it('ignores non-Tab keydown events in the focus trap handler', async () => {
        const user = userEvent.setup();
        render(
            <ProjectModal
                projects={[]}
                onSelect={vi.fn()}
                onCreate={vi.fn()}
            />
        );

        // Should not throw or change focus unexpectedly
        const input = screen.getByRole('textbox');
        input.focus();

        await user.keyboard('{ArrowDown}');
        expect(document.activeElement).toBe(input);
    });
});
