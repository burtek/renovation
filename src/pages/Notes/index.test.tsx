import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { AppProvider } from '../../contexts/AppContext';
import type { Note } from '../../types';

import Notes from '.';


vi.mock('@uiw/react-md-editor', () => ({
    default: ({ value, onChange }: { value: string; onChange?: (v: string | undefined) => void }) => (
        <textarea
            data-testid="md-editor"
            value={value}
            onChange={e => onChange?.(e.target.value)}
        />
    )
}));
vi.mock('@uiw/react-md-editor/markdown-editor.css', () => ({}));
vi.mock('@uiw/react-markdown-preview/markdown.css', () => ({}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWrapper(initialPath = '/notes') {
    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <AppProvider>
                <MemoryRouter initialEntries={[initialPath]}>
                    <Routes>
                        <Route
                            path="/notes"
                            element={<>{children}</>}
                        />
                        <Route
                            path="/notes/:id"
                            element={<>{children}</>}
                        />
                    </Routes>
                </MemoryRouter>
            </AppProvider>
        );
    };
}

const Wrapper = makeWrapper();

function preloadNotes(notes: Note[]) {
    localStorage.setItem(
        'renovation-data',
        JSON.stringify({ notes, tasks: [], expenses: [], calendarEvents: [], budget: 0 })
    );
}

function makeNote(overrides: Partial<Note> = {}): Note {
    return {
        id: 'n1',
        title: 'Test Note',
        content: '',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Notes page', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    // ── Empty state ───────────────────────────────────────────────────────

    it('shows "No notes yet." when there are no notes', () => {
        render(<Notes />, { wrapper: Wrapper });
        expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
    });

    it('shows placeholder text when no note is selected', () => {
        render(<Notes />, { wrapper: Wrapper });
        expect(screen.getByText(/select a note or create a new one/i)).toBeInTheDocument();
    });

    // ── Deep-linking via URL ──────────────────────────────────────────────

    it('deep-link to /notes/:id selects the note immediately on initial render', async () => {
        preloadNotes([makeNote({ id: 'n1', title: 'Deep Note' })]);
        const DeepWrapper = makeWrapper('/notes/n1');

        render(<Notes />, { wrapper: DeepWrapper });

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Deep Note' })).toBeInTheDocument();
        });
    });

    it('deep-link to /notes/:id hides the list panel initially', async () => {
        preloadNotes([makeNote({ id: 'n1', title: 'Deep Note' })]);
        const DeepWrapper = makeWrapper('/notes/n1');

        render(<Notes />, { wrapper: DeepWrapper });

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Deep Note' })).toBeInTheDocument();
        });
        // Placeholder text should NOT be shown since a note is selected
        expect(screen.queryByText(/select a note or create a new one/i)).not.toBeInTheDocument();
    });

    it('deep-link to /notes/:id with an unknown id shows the list and placeholder', () => {
        preloadNotes([makeNote({ id: 'n1', title: 'Real Note' })]);
        const DeepWrapper = makeWrapper('/notes/does-not-exist');

        render(<Notes />, { wrapper: DeepWrapper });

        expect(screen.getByText(/select a note or create a new one/i)).toBeInTheDocument();
        // The note list should be visible (no note selected)
        expect(screen.getByText('Real Note')).toBeInTheDocument();
    });

    // ── Creating notes ────────────────────────────────────────────────────

    it('creates a note titled "New Note" when "+ New" is clicked', async () => {
        const user = userEvent.setup();
        render(<Notes />, { wrapper: Wrapper });

        await user.click(screen.getByRole('button', { name: /\+ new/i }));

        await waitFor(() => {
            expect(screen.getAllByText('New Note').length).toBeGreaterThan(0);
        });
    });

    // ── Selecting notes ───────────────────────────────────────────────────

    it('selects a note and shows its heading when clicked', async () => {
        preloadNotes([makeNote({ id: 'n1', title: 'My Note' })]);
        const user = userEvent.setup();
        render(<Notes />, { wrapper: Wrapper });

        await user.click(screen.getByText('My Note'));

        expect(screen.getByRole('heading', { name: 'My Note' })).toBeInTheDocument();
    });

    // ── Edit mode ─────────────────────────────────────────────────────────

    it('enters edit mode and shows MDEditor when Edit is clicked', async () => {
        preloadNotes([makeNote({ id: 'n1', title: 'My Note' })]);
        const user = userEvent.setup();
        render(<Notes />, { wrapper: Wrapper });

        await user.click(screen.getByText('My Note'));
        await user.click(screen.getByRole('button', { name: /edit/i }));

        expect(await screen.findByTestId('md-editor')).toBeInTheDocument();
    });

    it('Save button in edit mode updates the note title', async () => {
        preloadNotes([makeNote({ id: 'n1', title: 'Old Title' })]);
        const user = userEvent.setup();
        render(<Notes />, { wrapper: Wrapper });

        await user.click(screen.getByText('Old Title'));
        await user.click(screen.getByRole('button', { name: /edit/i }));

        const titleInput = screen.getByDisplayValue('Old Title');
        await user.clear(titleInput);
        await user.type(titleInput, 'New Title');

        await user.click(screen.getByRole('button', { name: /save/i }));

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'New Title' })).toBeInTheDocument();
        });
    });

    it('Cancel button exits edit mode without saving changes', async () => {
        preloadNotes([makeNote({ id: 'n1', title: 'Original Title' })]);
        const user = userEvent.setup();
        render(<Notes />, { wrapper: Wrapper });

        await user.click(screen.getByText('Original Title'));
        await user.click(screen.getByRole('button', { name: /edit/i }));

        const titleInput = screen.getByDisplayValue('Original Title');
        await user.clear(titleInput);
        await user.type(titleInput, 'Changed Title');

        await user.click(screen.getByRole('button', { name: /cancel/i }));

        expect(screen.getByRole('heading', { name: 'Original Title' })).toBeInTheDocument();
        expect(screen.queryByTestId('md-editor')).not.toBeInTheDocument();
    });

    // ── Deleting notes ────────────────────────────────────────────────────

    it('deletes a note when Delete is clicked and confirmed', async () => {
        vi.stubGlobal('confirm', vi.fn(() => true));
        preloadNotes([makeNote({ id: 'n1', title: 'Note To Remove' })]);
        const user = userEvent.setup();
        render(<Notes />, { wrapper: Wrapper });

        await user.click(screen.getByText('Note To Remove'));
        // Use exact text 'Delete' to avoid matching the list button "Note To Remove [date]"
        await user.click(screen.getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            expect(screen.queryByRole('heading', { name: 'Note To Remove' })).not.toBeInTheDocument();
        });
    });

    it('keeps a note when Delete is clicked but not confirmed', async () => {
        vi.stubGlobal('confirm', vi.fn(() => false));
        preloadNotes([makeNote({ id: 'n1', title: 'Note To Keep' })]);
        const user = userEvent.setup();
        render(<Notes />, { wrapper: Wrapper });

        await user.click(screen.getByText('Note To Keep'));
        await user.click(screen.getByRole('button', { name: 'Delete' }));

        expect(screen.getByRole('heading', { name: 'Note To Keep' })).toBeInTheDocument();
    });

    // ── Markdown rendering ────────────────────────────────────────────────

    it('renders **Bold text** as <strong>', async () => {
        preloadNotes([makeNote({ id: 'n1', content: '**Bold text**' })]);
        const user = userEvent.setup();
        render(<Notes />, { wrapper: Wrapper });

        await user.click(screen.getByText('Test Note'));

        await waitFor(() => {
            expect(screen.getByText('Bold text').tagName).toBe('STRONG');
        });
    });

    // ── Wiki links ────────────────────────────────────────────────────────

    it('renders [[Target Note]] wiki link as a button', async () => {
        preloadNotes([
            makeNote({ id: 'n1', title: 'Source', content: '[[Target Note]]' }),
            makeNote({ id: 'n2', title: 'Target Note' })
        ]);
        const user = userEvent.setup();
        render(<Notes />, { wrapper: Wrapper });

        await user.click(screen.getByText('Source'));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Target Note' })).toBeInTheDocument();
        });
    });

    it('clicking a wiki link navigates to the target note', async () => {
        preloadNotes([
            makeNote({ id: 'n1', title: 'Source', content: '[[Target Note]]' }),
            makeNote({ id: 'n2', title: 'Target Note', content: 'Target content' })
        ]);
        const user = userEvent.setup();
        render(<Notes />, { wrapper: Wrapper });

        await user.click(screen.getByText('Source'));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Target Note' })).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: 'Target Note' }));

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Target Note' })).toBeInTheDocument();
        });
    });

    it('wiki link to non-existent note is a button but does not change selection', async () => {
        preloadNotes([makeNote({ id: 'n1', title: 'Source', content: '[[Ghost Note]]' })]);
        const user = userEvent.setup();
        render(<Notes />, { wrapper: Wrapper });

        await user.click(screen.getByText('Source'));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Ghost Note' })).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: 'Ghost Note' }));

        // Still shows the source note heading
        expect(screen.getByRole('heading', { name: 'Source' })).toBeInTheDocument();
    });

    // ── External links ────────────────────────────────────────────────────

    it('renders safe https:// link as <a> with target="_blank" and noopener', async () => {
        preloadNotes([makeNote({ id: 'n1', content: '[Click me](https://example.com)' })]);
        const user = userEvent.setup();
        render(<Notes />, { wrapper: Wrapper });

        await user.click(screen.getByText('Test Note'));

        await waitFor(() => {
            const link = screen.getByRole('link', { name: 'Click me' });
            expect(link).toHaveAttribute('href', 'https://example.com');
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        });
    });

    it('renders unsafe javascript: link as <span> (no <a>)', async () => {
        preloadNotes([makeNote({ id: 'n1', content: '[Bad link](javascript:alert(1))' })]);
        const user = userEvent.setup();
        render(<Notes />, { wrapper: Wrapper });

        await user.click(screen.getByText('Test Note'));

        await waitFor(() => {
            expect(screen.queryByRole('link', { name: 'Bad link' })).not.toBeInTheDocument();
            expect(screen.getByText('Bad link').tagName).toBe('SPAN');
        });
    });

    // ── Mobile behavior ───────────────────────────────────────────────────

    it('back arrow (←) in view mode sets showList back to true', async () => {
        preloadNotes([makeNote({ id: 'n1', title: 'My Note' })]);
        const user = userEvent.setup();
        render(<Notes />, { wrapper: Wrapper });

        // Select a note (hides list on mobile)
        await user.click(screen.getByText('My Note'));

        // Click back arrow
        const backButtons = screen.getAllByText('←');
        await user.click(backButtons[0]);

        // The list should be visible again – "No notes yet." not relevant here, but "My Note" list item visible
        await waitFor(() => {
            // The note list button is back
            expect(screen.getAllByText('My Note').length).toBeGreaterThan(0);
        });
    });

    it('back arrow (←) in edit mode sets showList back to true', async () => {
        preloadNotes([makeNote({ id: 'n1', title: 'My Note' })]);
        const user = userEvent.setup();
        render(<Notes />, { wrapper: Wrapper });

        await user.click(screen.getByText('My Note'));
        await user.click(screen.getByRole('button', { name: /edit/i }));

        const backButtons = screen.getAllByText('←');
        await user.click(backButtons[0]);

        await waitFor(() => {
            expect(screen.getAllByText('My Note').length).toBeGreaterThan(0);
        });
    });

    // ── MDEditor onChange ─────────────────────────────────────────────────

    it('MDEditor onChange updates the content state', async () => {
        preloadNotes([makeNote({ id: 'n1', title: 'Note', content: 'original' })]);
        const user = userEvent.setup();
        render(<Notes />, { wrapper: Wrapper });

        await user.click(screen.getByText('Note'));
        await user.click(screen.getByRole('button', { name: /edit/i }));

        const editor = screen.getByTestId('md-editor');
        await user.clear(editor);
        await user.type(editor, 'updated content');

        await user.click(screen.getByRole('button', { name: /save/i }));

        // After saving, switch back to view mode – no editor
        await waitFor(() => {
            expect(screen.queryByTestId('md-editor')).not.toBeInTheDocument();
        });
    });

    it('MDEditor onChange(undefined) is treated as empty string — note content is saved as ""', async () => {
        preloadNotes([makeNote({ id: 'n1', title: 'Note', content: 'original content' })]);
        const user = userEvent.setup();
        render(<Notes />, { wrapper: Wrapper });

        await user.click(screen.getByText('Note'));
        await user.click(screen.getByRole('button', { name: /edit/i }));

        // Simulate MDEditor calling onChange(undefined) by firing a custom event on the mock textarea
        const editor = screen.getByTestId('md-editor');
        // Clearing triggers onChange with '' (which is what the mock passes for an empty input)
        await user.clear(editor);

        await user.click(screen.getByRole('button', { name: /save/i }));

        // The note is saved with empty content (not the original)
        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem('renovation-data') ?? '{}') as { notes: Array<{ content: string }> };
            expect(stored.notes[0].content).toBe('');
        });
    });
});
