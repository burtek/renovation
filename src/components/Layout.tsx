import { Suspense, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { cn } from '../utils/classnames';

import SaveLoadButtons from './SaveLoadButtons';


const navItems = [
    { to: '/notes', label: '📝 Notes' },
    { to: '/tasks', label: '✅ Tasks' },
    { to: '/finance', label: '💰 Finance' },
    { to: '/calendar', label: '📅 Calendar' }
];

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
            {/* Mobile backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden"
                    onClick={() => {
                        setSidebarOpen(false);
                    }}
                />
            )}

            {/* Sidebar */}
            <aside className={cn(
                'fixed md:relative inset-y-0 left-0 z-40 md:z-auto',
                'w-56 bg-gray-900 text-white flex flex-col shrink-0',
                'transition-transform md:translate-x-0',
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            )}
            >
                <div className="p-4 text-xl font-bold border-b border-gray-700 flex items-center justify-between">
                    <span>🏠 Renovation</span>
                    <button
                        type="button"
                        onClick={() => {
                            setSidebarOpen(false);
                        }}
                        className="md:hidden text-gray-400 hover:text-white leading-none"
                        aria-label="Close menu"
                    >
                        ✕
                    </button>
                </div>
                <nav className="flex-1 py-4">
                    {navItems.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => {
                                setSidebarOpen(false);
                            }}
                            className={({ isActive }) =>
                                cn('block px-4 py-3 text-sm transition hover:bg-gray-700', isActive && 'bg-gray-700 border-l-4 border-blue-400')}
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
                <SaveLoadButtons />
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Mobile top bar */}
                <div className="md:hidden flex items-center gap-3 p-3 bg-gray-900 text-white shrink-0">
                    <button
                        type="button"
                        onClick={() => {
                            setSidebarOpen(true);
                        }}
                        className="text-white p-1"
                        aria-label="Open menu"
                    >
                        <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 6h16M4 12h16M4 18h16"
                            />
                        </svg>
                    </button>
                    <span className="font-bold text-lg">🏠 Renovation</span>
                </div>
                <main className="flex-1 overflow-auto">
                    <Suspense fallback={(
                        <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
                            Loading…
                        </div>
                    )}
                    >
                        <Outlet />
                    </Suspense>
                </main>
            </div>
        </div>
    );
}
