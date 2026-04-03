/**
 * Unit tests for NoteEditor.
 *
 * The @uiw/react-md-editor component calls its `onChange` prop with
 * `string | undefined`.  The nullish-coalescing guard `v ?? ''` in NoteEditor
 * ensures we always forward a `string` to the parent.  This test covers the
 * `undefined` branch of that guard — i.e. what happens when MDEditor signals
 * "content cleared" by passing `undefined`.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import NoteEditor from './NoteEditor';


// Mock MDEditor with a button that fires onChange(undefined) so we can test
// the nullish-coalescing branch in NoteEditor (v ?? '').
vi.mock('@uiw/react-md-editor', () => ({
    default: ({ onChange }: { onChange?: (v: string | undefined) => void }) => (
        <button
            type="button"
            data-testid="trigger-undefined-change"
            onClick={() => {
                onChange?.(undefined);
            }}
        >
            Clear
        </button>
    )
}));
vi.mock('@uiw/react-md-editor/markdown-editor.css', () => ({}));
vi.mock('@uiw/react-markdown-preview/markdown.css', () => ({}));


describe('NoteEditor', () => {
    it('passes empty string to onContentChange when MDEditor fires onChange(undefined)', async () => {
        const onContentChange = vi.fn();
        const user = userEvent.setup();

        render(
            <NoteEditor
                editTitle="Test Note"
                editContent="some existing content"
                onTitleChange={vi.fn()}
                onContentChange={onContentChange}
                onSave={vi.fn()}
                onCancel={vi.fn()}
                onShowList={vi.fn()}
            />
        );

        // Clicking triggers the mock to call onChange(undefined)
        await user.click(screen.getByTestId('trigger-undefined-change'));

        // NoteEditor must convert undefined → '' before forwarding
        expect(onContentChange).toHaveBeenCalledWith('');
        expect(onContentChange).not.toHaveBeenCalledWith(undefined);
    });
});
