import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import { useEffect, useReducer, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { v4 as uuidv4 } from 'uuid';

import { useApp } from '../contexts/AppContext';
import { useColorScheme } from '../hooks/useColorScheme';
import type { Note } from '../types';
import { cn } from '../utils/classnames';


interface UIState {
    editing: boolean;
    editTitle: string;
    editContent: string;
    showList: boolean;
}

type UIAction
    = | { type: 'NOTE_NAVIGATED'; note: Note | null }
        | { type: 'SHOW_NOTE' }
        | { type: 'START_EDIT'; title: string; content: string }
        | { type: 'CANCEL_EDIT' }
        | { type: 'FINISH_SAVE' }
        | { type: 'SET_TITLE'; title: string }
        | { type: 'SET_CONTENT'; content: string }
        | { type: 'SHOW_LIST' };

function uiReducer(state: UIState, action: UIAction): UIState {
    switch (action.type) {
        case 'NOTE_NAVIGATED':
            return action.note
                ? { editing: false, editTitle: action.note.title, editContent: action.note.content, showList: false }
                : { editing: false, editTitle: '', editContent: '', showList: true };
        case 'SHOW_NOTE':
            return { ...state, showList: false, editing: false };
        case 'START_EDIT':
            return { ...state, editing: true, editTitle: action.title, editContent: action.content };
        case 'CANCEL_EDIT':
            return { ...state, editing: false };
        case 'FINISH_SAVE':
            return { ...state, editing: false };
        case 'SET_TITLE':
            return { ...state, editTitle: action.title };
        case 'SET_CONTENT':
            return { ...state, editContent: action.content };
        case 'SHOW_LIST':
            return { ...state, showList: true };
        // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
        default:
            return state;
    }
}

export default function Notes() {
    const { state, dispatch } = useApp();
    const colorScheme = useColorScheme();
    const navigate = useNavigate();
    const { id: noteId } = useParams<{ id?: string }>();

    const selectedNote = state.notes.find(n => n.id === noteId) ?? null;

    const [ui, uiDispatch] = useReducer(uiReducer, {
        editing: false,
        editTitle: selectedNote?.title ?? '',
        editContent: selectedNote?.content ?? '',
        showList: !selectedNote
    });
    const { editing, editTitle, editContent, showList } = ui;

    // Keep a ref to selectedNote so the effect below doesn't need it as a dep
    const selectedNoteRef = useRef(selectedNote);
    selectedNoteRef.current = selectedNote;

    // Reset UI state when navigating to a different note via URL
    useEffect(() => {
        uiDispatch({ type: 'NOTE_NAVIGATED', note: selectedNoteRef.current });
    }, [noteId]);

    // Update document title based on selected note
    useEffect(() => {
        document.title = selectedNote
            ? `${selectedNote.title} – Notes | Renovation`
            : 'Notes | Renovation';
    }, [selectedNote]);

    const handleSelect = (note: Note) => {
        // Always hide the list and reset editing when a note is selected,
        // even if it's the currently-selected note (noteId doesn't change).
        uiDispatch({ type: 'SHOW_NOTE' });
        navigate(`/notes/${note.id}`);
    };

    const handleNew = () => {
        const newId = uuidv4();
        dispatch({ type: 'ADD_NOTE', payload: { id: newId, title: 'New Note', content: '' } });
        navigate(`/notes/${newId}`);
    };

    const handleDelete = () => {
        if (!selectedNote) {
            return;
        }
        // eslint-disable-next-line no-alert
        if (confirm('Delete this note?')) {
            dispatch({ type: 'DELETE_NOTE', payload: selectedNote.id });
            navigate('/notes');
        }
    };

    const handleSave = () => {
        if (!selectedNote) {
            return;
        }
        dispatch({ type: 'UPDATE_NOTE', payload: { ...selectedNote, title: editTitle, content: editContent } });
        uiDispatch({ type: 'FINISH_SAVE' });
    };

    const handleEdit = () => {
        if (!selectedNote) {
            return;
        }
        uiDispatch({ type: 'START_EDIT', title: selectedNote.title, content: selectedNote.content });
    };

    const navigateToNote = (title: string) => {
        const note = state.notes.find(n => n.title.toLowerCase() === title.toLowerCase());
        if (note) {
            navigate(`/notes/${note.id}`);
        }
    };

    const processedContent = selectedNote?.content.replace(/\[\[(.*?)\]\]/g, (_, title) => `[${title}](#note-link-${encodeURIComponent(title)})`) ?? '';

    const renderNotePanel = () => {
        if (!selectedNote) {
            return (
                <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
                    Select a note or create a new one
                </div>
            );
        }
        if (editing) {
            return (
                <div className="flex flex-col h-full">
                    <div className="p-4 border-b flex items-center gap-2 bg-white dark:bg-gray-800 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={() => {
                                uiDispatch({ type: 'SHOW_LIST' });
                            }}
                            className="md:hidden text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 mr-1"
                        >←
                        </button>
                        <input
                            value={editTitle}
                            onChange={e => {
                                uiDispatch({ type: 'SET_TITLE', title: e.target.value });
                            }}
                            className="flex-1 text-xl font-bold border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-400 pb-1 bg-transparent dark:text-gray-100"
                        />
                        <button
                            type="button"
                            onClick={handleSave}
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                        >Save
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                uiDispatch({ type: 'CANCEL_EDIT' });
                            }}
                            className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-300"
                        >Cancel
                        </button>
                    </div>
                    <div
                        className="flex-1 overflow-hidden"
                        data-color-mode={colorScheme}
                    >
                        <MDEditor
                            value={editContent}
                            onChange={v => {
                                uiDispatch({ type: 'SET_CONTENT', content: v ?? '' });
                            }}
                            height="100%"
                            preview="edit"
                        />
                    </div>
                </div>
            );
        }
        return (
            <div className="flex flex-col h-full">
                <div className="p-4 border-b flex items-center gap-2 bg-white dark:bg-gray-800 dark:border-gray-700">
                    <button
                        type="button"
                        onClick={() => {
                            uiDispatch({ type: 'SHOW_LIST' });
                        }}
                        className="md:hidden text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 mr-1"
                    >←
                    </button>
                    <h1 className="flex-1 text-xl font-bold text-gray-800 dark:text-gray-100">{selectedNote.title}</h1>
                    <button
                        type="button"
                        onClick={handleEdit}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                    >Edit
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                    >Delete
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 prose dark:prose-invert max-w-none">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            a: ({ href, children }) => {
                                if (href?.startsWith('#note-link-')) {
                                    const title = decodeURIComponent(href.replace('#note-link-', ''));
                                    return (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigateToNote(title);
                                            }}
                                            className="text-blue-600 underline hover:text-blue-800"
                                        >
                                            {children}
                                        </button>
                                    );
                                }
                                const isSafe = href && /^https?:|^mailto:/i.test(href);
                                if (!isSafe) {
                                    return <span>{children}</span>;
                                }
                                return (
                                    <a
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >{children}
                                    </a>
                                );
                            }
                        }}
                    >
                        {processedContent}
                    </ReactMarkdown>
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-full">
            {/* Left panel - notes list */}
            <div className={cn(showList ? 'flex' : 'hidden', 'md:flex flex-col w-full md:w-64 bg-white dark:bg-gray-800 border-r dark:border-gray-700 shrink-0')}>
                <div className="p-3 border-b dark:border-gray-700 flex justify-between items-center">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Notes</span>
                    <button
                        type="button"
                        onClick={handleNew}
                        className="bg-blue-600 text-white text-xs px-2 py-1 rounded hover:bg-blue-700"
                    >
                        + New
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {state.notes.length === 0
                        && <p className="text-gray-400 dark:text-gray-500 text-sm p-4">No notes yet.</p>}
                    {state.notes.map(note => (
                        <button
                            type="button"
                            key={note.id}
                            onClick={() => {
                                handleSelect(note);
                            }}
                            className={cn('w-full text-left px-4 py-3 border-b dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition', noteId === note.id && 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-400')}
                        >
                            <div className="font-medium truncate dark:text-gray-200">{note.title}</div>
                            <div className="text-gray-400 dark:text-gray-500 text-xs">{new Date(note.updatedAt).toLocaleDateString()}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Right panel - note content */}
            <div className={cn(showList ? 'hidden' : 'flex', 'md:flex flex-1 flex-col overflow-hidden bg-white dark:bg-gray-800')}>
                {renderNotePanel()}
            </div>
        </div>
    );
}
