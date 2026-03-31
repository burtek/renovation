interface AboutDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
    if (!isOpen) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg shadow-xl max-w-md w-full p-6"
                onClick={e => {
                    e.stopPropagation();
                }}
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">🏠 About Renovation</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 leading-none text-xl"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>
                <div className="space-y-3 text-sm leading-relaxed">
                    <p>
                        <strong>Renovation</strong>
                        {' '}
                        is a web-based project management application
                        for planning and tracking home renovation projects.
                    </p>
                    <p>It brings together all the tools you need in one place:</p>
                    <ul className="list-disc list-inside space-y-1 pl-2">
                        <li>
                            <strong>📝 Notes</strong>
                            {' '}
                            — Markdown-based notes editor
                        </li>
                        <li>
                            <strong>✅ Tasks</strong>
                            {' '}
                            — Task list with Gantt chart view
                        </li>
                        <li>
                            <strong>💰 Finance</strong>
                            {' '}
                            — Expense tracking and budget overview
                        </li>
                        <li>
                            <strong>📅 Calendar</strong>
                            {' '}
                            — Event scheduling with drag-and-drop
                        </li>
                    </ul>
                    <p>All data is stored locally in your browser and can be exported or imported at any time.</p>
                    <p className="pt-2 border-t border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 italic">
                        This application was fully created by AI.
                    </p>
                </div>
            </div>
        </div>
    );
}
