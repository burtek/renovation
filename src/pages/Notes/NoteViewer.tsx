import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import type { Note } from '../../types';


interface Props {
    note: Note;
    notes: Note[];
    onEdit: () => void;
    onDelete: () => void;
    onShowList: () => void;
}

export default function NoteViewer({ note, notes, onEdit, onDelete, onShowList }: Props) {
    const navigate = useNavigate();

    const navigateToNote = (title: string) => {
        const found = notes.find(n => n.title.toLowerCase() === title.toLowerCase());
        if (found) {
            navigate(`/notes/${found.id}`);
        }
    };

    const processedContent = note.content.replace(/\[\[(.*?)\]\]/g, (_, title) => `[${title}](#note-link-${encodeURIComponent(title)})`);

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b flex items-center gap-2 bg-white dark:bg-gray-800 dark:border-gray-700">
                <button
                    type="button"
                    onClick={onShowList}
                    className="md:hidden text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 mr-1"
                >←
                </button>
                <h1 className="flex-1 text-xl font-bold text-gray-800 dark:text-gray-100">{note.title}</h1>
                <button
                    type="button"
                    onClick={onEdit}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                >Edit
                </button>
                <button
                    type="button"
                    onClick={onDelete}
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
}
