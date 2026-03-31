import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { v4 as uuidv4 } from 'uuid';

import { useApp } from '../contexts/AppContext';
import { useColorScheme } from '../hooks/useColorScheme';
import type { Note } from '../types';
import { cn } from '../utils/classnames';


export default function Notes() {
    const { state, dispatch } = useApp();
    const colorScheme = useColorScheme();
    const navigate = useNavigate();
    const { id: noteId } = useParams<{ id?: string }>();

    const selectedNote = state.notes.find(n => n.id === noteId) ?? null;

    const [editing, setEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(selectedNote?.title ?? '');
    const [editContent, setEditContent] = useState(selectedNote?.content ?? '');
    const [showList, setShowList] = useState(!selectedNote);

    // Reset edit state when navigating to a different note via URL
    const [prevNoteId, setPrevNoteId] = useState(noteId);
    if (prevNoteId !== noteId) {
        setPrevNoteId(noteId);
        setEditing(false);
        if (selectedNote) {
            setEditTitle(selectedNote.title);
            setEditContent(selectedNote.content);
            setShowList(false);
        } else {
            setShowList(true);
        }
    }

    // Update document title based on selected note
    useEffect(() => {
        document.title = selectedNote
            ? `${selectedNote.title} – Notes | Renovation`
            : 'Notes | Renovation';
    }, [selectedNote]);

    const handleSelect = (note: Note) => {
        // Always hide the list and reset editing when a note is selected,
        // even if it's the currently-selected note (noteId doesn't change).
        setShowList(false);
        setEditing(false);
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
        setEditing(false);
    };

    const handleEdit = () => {
        if (!selectedNote) {
            return;
        }
        setEditTitle(selectedNote.title);
        setEditContent(selectedNote.content);
        setEditing(true);
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
                                setShowList(true);
                            }}
                            className="md:hidden text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 mr-1"
                        >←
                        </button>
                        <input
                            value={editTitle}
                            onChange={e => {
                                setEditTitle(e.target.value);
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
                                setEditing(false);
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
                                setEditContent(v ?? '');
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
                            setShowList(true);
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
