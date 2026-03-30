export interface Note {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
}

export interface Subtask {
    id: string;
    parentId: string;
    title: string;
    notes: string;
    startDate?: string;
    endDate?: string;
    assignee?: string;
    dependsOn?: string[];
    completed: boolean;
}

export interface Task {
    id: string;
    title: string;
    notes: string;
    startDate?: string;
    endDate?: string;
    assignee?: string;
    dependsOn?: string[];
    subtasks: Subtask[];
    completed: boolean;
}

export interface Expense {
    id: string;
    description: string;
    date: string;
    price: number;
    shopName: string;
    invoiceNo: string;
    invoiceForm: 'paper' | 'gdrive';
    invoiceLink?: string;
    loanApproved: boolean;
}

export type CalendarEventType = 'event' | 'own work' | 'visit/measurements' | 'contractor work';

export interface CalendarEvent {
    id: string;
    date: string; // start date
    endDate?: string; // end date for multi-day events
    title: string;
    contractor?: string;
    eventType: CalendarEventType;
    notes?: string;
}

export interface AppData {
    notes: Note[];
    tasks: Task[];
    expenses: Expense[];
    calendarEvents: CalendarEvent[];
    budget: number;
}
