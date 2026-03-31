import { lazy, Suspense, useEffect, useReducer, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

import { useApp } from '../../contexts/AppContext';
import type { Note } from '../../types';
import { cn } from '../../utils/classnames';

import NoteViewer from './NoteViewer';


const NoteEditor = lazy(() => import('./NoteEditor'));


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
                <Suspense fallback={(
                    <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
                        Loading editor…
                    </div>
                )}
                >
                    <NoteEditor
                        editTitle={editTitle}
                        editContent={editContent}
                        onTitleChange={title => {
                            uiDispatch({ type: 'SET_TITLE', title });
                        }}
                        onContentChange={content => {
                            uiDispatch({ type: 'SET_CONTENT', content });
                        }}
                        onSave={handleSave}
                        onCancel={() => {
                            uiDispatch({ type: 'CANCEL_EDIT' });
                        }}
                        onShowList={() => {
                            uiDispatch({ type: 'SHOW_LIST' });
                        }}
                    />
                </Suspense>
            );
        }
        return (
            <NoteViewer
                note={selectedNote}
                notes={state.notes}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onShowList={() => {
                    uiDispatch({ type: 'SHOW_LIST' });
                }}
            />
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
