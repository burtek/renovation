import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import Layout from './components/Layout';
import Notes from './pages/Notes';
import Tasks from './pages/Tasks';
import Finance from './pages/Finance';
import CalendarPage from './pages/Calendar';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/notes" replace />} />
            <Route path="notes" element={<Notes />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="finance" element={<Finance />} />
            <Route path="calendar" element={<CalendarPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
