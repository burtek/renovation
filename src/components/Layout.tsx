import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import SaveLoadButtons from './SaveLoadButtons';

const navItems = [
  { to: '/notes', label: '📝 Notes' },
  { to: '/tasks', label: '✅ Tasks' },
  { to: '/finance', label: '💰 Finance' },
  { to: '/calendar', label: '📅 Calendar' },
];

export default function Layout() {
  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-56 bg-gray-900 text-white flex flex-col shrink-0">
        <div className="p-4 text-xl font-bold border-b border-gray-700">🏠 Renovation</div>
        <nav className="flex-1 py-4">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-4 py-3 text-sm transition hover:bg-gray-700 ${isActive ? 'bg-gray-700 border-l-4 border-blue-400' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <SaveLoadButtons />
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
