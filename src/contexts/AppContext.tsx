import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { AppData, Note, Task, Subtask, Expense, CalendarEvent } from '../types';
import { v4 as uuidv4 } from 'uuid';

const initialState: AppData = {
  notes: [],
  tasks: [],
  expenses: [],
  calendarEvents: [],
  budget: 0,
};

type Action =
  | { type: 'SET_ALL'; payload: AppData }
  | { type: 'ADD_NOTE'; payload: Omit<Note, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_NOTE'; payload: Note }
  | { type: 'DELETE_NOTE'; payload: string }
  | { type: 'ADD_TASK'; payload: Omit<Task, 'id'> }
  | { type: 'UPDATE_TASK'; payload: Task }
  | { type: 'DELETE_TASK'; payload: string }
  | { type: 'ADD_SUBTASK'; payload: { taskId: string; subtask: Omit<Subtask, 'id'> } }
  | { type: 'UPDATE_SUBTASK'; payload: { taskId: string; subtask: Subtask } }
  | { type: 'DELETE_SUBTASK'; payload: { taskId: string; subtaskId: string } }
  | { type: 'ADD_EXPENSE'; payload: Omit<Expense, 'id'> }
  | { type: 'UPDATE_EXPENSE'; payload: Expense }
  | { type: 'DELETE_EXPENSE'; payload: string }
  | { type: 'ADD_CALENDAR_EVENT'; payload: Omit<CalendarEvent, 'id'> }
  | { type: 'UPDATE_CALENDAR_EVENT'; payload: CalendarEvent }
  | { type: 'DELETE_CALENDAR_EVENT'; payload: string }
  | { type: 'SET_BUDGET'; payload: number };

function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'SET_ALL':
      return action.payload;
    case 'ADD_NOTE': {
      const now = new Date().toISOString();
      const note: Note = { ...action.payload, id: uuidv4(), createdAt: now, updatedAt: now };
      return { ...state, notes: [...state.notes, note] };
    }
    case 'UPDATE_NOTE': {
      const updated = { ...action.payload, updatedAt: new Date().toISOString() };
      return { ...state, notes: state.notes.map(n => n.id === updated.id ? updated : n) };
    }
    case 'DELETE_NOTE':
      return { ...state, notes: state.notes.filter(n => n.id !== action.payload) };
    case 'ADD_TASK': {
      const task: Task = { ...action.payload, id: uuidv4() };
      return { ...state, tasks: [...state.tasks, task] };
    }
    case 'UPDATE_TASK':
      return { ...state, tasks: state.tasks.map(t => t.id === action.payload.id ? action.payload : t) };
    case 'DELETE_TASK':
      return { ...state, tasks: state.tasks.filter(t => t.id !== action.payload) };
    case 'ADD_SUBTASK': {
      const subtask: Subtask = { ...action.payload.subtask, id: uuidv4() };
      return {
        ...state,
        tasks: state.tasks.map(t =>
          t.id === action.payload.taskId ? { ...t, subtasks: [...t.subtasks, subtask] } : t
        ),
      };
    }
    case 'UPDATE_SUBTASK':
      return {
        ...state,
        tasks: state.tasks.map(t =>
          t.id === action.payload.taskId
            ? { ...t, subtasks: t.subtasks.map(s => s.id === action.payload.subtask.id ? action.payload.subtask : s) }
            : t
        ),
      };
    case 'DELETE_SUBTASK':
      return {
        ...state,
        tasks: state.tasks.map(t =>
          t.id === action.payload.taskId
            ? { ...t, subtasks: t.subtasks.filter(s => s.id !== action.payload.subtaskId) }
            : t
        ),
      };
    case 'ADD_EXPENSE': {
      const expense: Expense = { ...action.payload, id: uuidv4() };
      return { ...state, expenses: [...state.expenses, expense] };
    }
    case 'UPDATE_EXPENSE':
      return { ...state, expenses: state.expenses.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'DELETE_EXPENSE':
      return { ...state, expenses: state.expenses.filter(e => e.id !== action.payload) };
    case 'ADD_CALENDAR_EVENT': {
      const event: CalendarEvent = { ...action.payload, id: uuidv4() };
      return { ...state, calendarEvents: [...state.calendarEvents, event] };
    }
    case 'UPDATE_CALENDAR_EVENT':
      return { ...state, calendarEvents: state.calendarEvents.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'DELETE_CALENDAR_EVENT':
      return { ...state, calendarEvents: state.calendarEvents.filter(e => e.id !== action.payload) };
    case 'SET_BUDGET':
      return { ...state, budget: action.payload };
    default:
      return state;
  }
}

interface AppContextType {
  state: AppData;
  dispatch: React.Dispatch<Action>;
  saveToFile: () => void;
  loadFromFile: (file: File) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, () => {
    try {
      const stored = localStorage.getItem('renovation-data');
      if (stored) return JSON.parse(stored) as AppData;
    } catch {}
    return initialState;
  });

  useEffect(() => {
    localStorage.setItem('renovation-data', JSON.stringify(state));
  }, [state]);

  const saveToFile = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `renovation-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as AppData;
        dispatch({ type: 'SET_ALL', payload: data });
      } catch {
        alert('Failed to parse JSON file. Please ensure the file is a valid renovation backup file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <AppContext.Provider value={{ state, dispatch, saveToFile, loadFromFile }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
