import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useApp } from '../contexts/AppContext';
import type { Note } from '../types';


export default function Notes() {
    const { state, dispatch } = useApp();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [showList, setShowList] = useState(true);

    const selectedNote = state.notes.find(n => n.id === selectedId) ?? null;

    const handleSelect = (note: Note) => {
        setSelectedId(note.id);
        setEditing(false);
        setEditTitle(note.title);
        setEditContent(note.content);
        setShowList(false);
    };

    const handleNew = () => {
        dispatch({ type: 'ADD_NOTE', payload: { title: 'New Note', content: '' } });
    };

    const handleDelete = () => {
        if (!selectedNote) {
            return;
        }
        // eslint-disable-next-line no-alert
        if (confirm('Delete this note?')) {
            dispatch({ type: 'DELETE_NOTE', payload: selectedNote.id });
            setSelectedId(null);
            setEditing(false);
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
            handleSelect(note);
        }
    };

    const processedContent = selectedNote?.content.replace(/\[\[(.*?)\]\]/g, (_, title) => `[${title}](#note-link-${encodeURIComponent(title)})`) ?? '';

    const renderNotePanel = () => {
        if (!selectedNote) {
            return (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                    Select a note or create a new one
                </div>
            );
        }
        if (editing) {
            return (
                <div className="flex flex-col h-full">
                    <div className="p-4 border-b flex items-center gap-2 bg-white">
                        <button
                            type="button"
                            onClick={() => {
                                setShowList(true);
                            }}
                            className="md:hidden text-gray-500 hover:text-gray-800 mr-1"
                        >←
                        </button>
                        <input
                            value={editTitle}
                            onChange={e => {
                                setEditTitle(e.target.value);
                            }}
                            className="flex-1 text-xl font-bold border-b border-gray-300 focus:outline-none focus:border-blue-400 pb-1"
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
                        data-color-mode="light"
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
                <div className="p-4 border-b flex items-center gap-2 bg-white">
                    <button
                        type="button"
                        onClick={() => {
                            setShowList(true);
                        }}
                        className="md:hidden text-gray-500 hover:text-gray-800 mr-1"
                    >←
                    </button>
                    <h1 className="flex-1 text-xl font-bold text-gray-800">{selectedNote.title}</h1>
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
                <div className="flex-1 overflow-y-auto p-6 prose max-w-none">
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
            <div className={`${showList ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-64 bg-white border-r shrink-0`}>
                <div className="p-3 border-b flex justify-between items-center">
                    <span className="font-semibold text-gray-700">Notes</span>
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
                        && <p className="text-gray-400 text-sm p-4">No notes yet.</p>}
                    {state.notes.map(note => (
                        <button
                            type="button"
                            key={note.id}
                            onClick={() => {
                                handleSelect(note);
                            }}
                            className={`w-full text-left px-4 py-3 border-b text-sm hover:bg-gray-50 transition ${
                                selectedId === note.id ? 'bg-blue-50 border-l-4 border-blue-400' : ''
                            }`}
                        >
                            <div className="font-medium truncate">{note.title}</div>
                            <div className="text-gray-400 text-xs">{new Date(note.updatedAt).toLocaleDateString()}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Right panel - note content */}
            <div className={`${showList ? 'hidden' : 'flex'} md:flex flex-1 flex-col overflow-hidden`}>
                {renderNotePanel()}
            </div>
        </div>
    );
}
