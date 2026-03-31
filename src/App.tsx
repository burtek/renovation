import { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import { AppProvider } from './contexts/AppContext';


const CalendarPage = lazy(() => import('./pages/Calendar'));
const Finance = lazy(() => import('./pages/Finance'));
const Notes = lazy(() => import('./pages/Notes'));
const Tasks = lazy(() => import('./pages/Tasks'));


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
                        <Route path="tasks">
                            <Route
                                index
                                element={(
                                    <Navigate
                                        to="/tasks/list"
                                        replace
                                    />
                                )}
                            />
                            <Route
                                path="list"
                                element={<Tasks />}
                            />
                            <Route
                                path="gantt"
                                element={<Tasks />}
                            />
                        </Route>
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
