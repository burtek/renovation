import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import { AppProvider } from './contexts/AppContext';
import CalendarPage from './pages/Calendar';
import Finance from './pages/Finance';
import Notes from './pages/Notes';
import Tasks from './pages/Tasks';


export default function App() {
    return (
        <AppProvider>
            <BrowserRouter>
                <Routes>
                    <Route
                        path="/"
                        element={<Layout />}
                    >
                        <Route
                            index
                            element={(
                                <Navigate
                                    to="/notes"
                                    replace
                                />
                            )}
                        />
                        <Route path="notes">
                            <Route
                                index
                                element={<Notes />}
                            />
                            <Route
                                path=":id"
                                element={<Notes />}
                            />
                        </Route>
                        <Route
                            path="tasks"
                            element={<Tasks />}
                        />
                        <Route
                            path="finance"
                            element={<Finance />}
                        />
                        <Route
                            path="calendar"
                            element={<CalendarPage />}
                        />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AppProvider>
    );
}
