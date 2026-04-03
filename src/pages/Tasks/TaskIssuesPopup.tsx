import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../../utils/classnames';

import type { TaskIssue } from './issues';
import { issuePlugins } from './issues';


interface Props {
    issues: TaskIssue[];
    isOpen: boolean;
    /** Viewport-relative position computed by the parent from the anchor button. */
    pos: { top: number; right: number } | null;
    /** The badge button element — excluded from the outside-click check. */
    anchorRef: RefObject<HTMLButtonElement | null>;
    onClose: () => void;
}

export default function TaskIssuesPopup({ issues, isOpen, pos, anchorRef, onClose }: Props) {
    const popupRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside — the anchor button is explicitly excluded so
    // the badge's own onClick toggle handles open/close without fighting this handler.
    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }
        const handleClick = (e: MouseEvent) => {
            const { target } = e;
            if (
                target instanceof Node
                && !popupRef.current?.contains(target)
                && !anchorRef.current?.contains(target)
            ) {
                onClose();
            }
        };
        document.addEventListener('click', handleClick);
        return () => {
            document.removeEventListener('click', handleClick);
        };
    }, [isOpen, onClose, anchorRef]);

    // Close on Escape.
    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('keydown', handleKey);
        };
    }, [isOpen, onClose]);

    if (!isOpen) {
        return null;
    }

    return createPortal(
        <div
            ref={popupRef}
            style={pos
                ? { position: 'fixed', top: pos.top, right: pos.right }
                : { position: 'fixed', visibility: 'hidden' }}
            className={cn(
                'z-50',
                'w-[28rem] max-h-[70vh] overflow-y-auto',
                'bg-white dark:bg-gray-800 border dark:border-gray-700',
                'rounded-lg shadow-xl'
            )}
        >
            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
                <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
                    ⚠️ Task Issues ({issues.length})
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none"
                    aria-label="Close issues panel"
                >
                    ✕
                </button>
            </div>
            <ul className="divide-y dark:divide-gray-700">
                {issues.map(issue => {
                    const plugin = issuePlugins.find(p => p.handles(issue));
                    if (!plugin) {
                        return null;
                    }
                    return (
                        <li
                            key={plugin.key(issue)}
                            className="px-4 py-3"
                        >
                            {plugin.renderFix(issue, onClose)}
                        </li>
                    );
                })}
            </ul>
        </div>,
        document.body
    );
}
