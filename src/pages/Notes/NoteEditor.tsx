import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

import { useColorScheme } from '../../hooks/useColorScheme';


interface Props {
    editTitle: string;
    editContent: string;
    onTitleChange: (title: string) => void;
    onContentChange: (content: string) => void;
    onSave: () => void;
    onCancel: () => void;
    onShowList: () => void;
}

export default function NoteEditor({ editTitle, editContent, onTitleChange, onContentChange, onSave, onCancel, onShowList }: Props) {
    const colorScheme = useColorScheme();

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b flex items-center gap-2 bg-white dark:bg-gray-800 dark:border-gray-700">
                <button
                    type="button"
                    onClick={onShowList}
                    className="md:hidden text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 mr-1"
                >←
                </button>
                <input
                    value={editTitle}
                    onChange={e => {
                        onTitleChange(e.target.value);
                    }}
                    className="flex-1 text-xl font-bold border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-400 pb-1 bg-transparent dark:text-gray-100"
                />
                <button
                    type="button"
                    onClick={onSave}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                >Save
                </button>
                <button
                    type="button"
                    onClick={onCancel}
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
                        onContentChange(v ?? '');
                    }}
                    height="100%"
                    preview="edit"
                />
            </div>
        </div>
    );
}
