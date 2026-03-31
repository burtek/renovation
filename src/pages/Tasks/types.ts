export interface TaskFormData {
    title: string;
    notes: string;
    startDate: string;
    endDate: string;
    assignee: string;
    completed: boolean;
    dependsOn: string[];
}

export interface SubtaskFormData {
    title: string;
    notes: string;
    startDate: string;
    endDate: string;
    assignee: string;
    completed: boolean;
    dependsOn: string[];
}

export const emptyTaskForm: TaskFormData = {
    title: '',
    notes: '',
    startDate: '',
    endDate: '',
    assignee: '',
    completed: false,
    dependsOn: []
};

export const emptySubtaskForm: SubtaskFormData = {
    title: '',
    notes: '',
    startDate: '',
    endDate: '',
    assignee: '',
    completed: false,
    dependsOn: []
};

export const MS_PER_DAY = 86_400_000;

export function addDays(dateStr: string, days: number): string {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

export function dayDiff(laterDate: string, earlierDate: string): number {
    const later = new Date(`${laterDate}T00:00:00Z`);
    const earlier = new Date(`${earlierDate}T00:00:00Z`);
    return Math.round((later.getTime() - earlier.getTime()) / MS_PER_DAY);
}

export function getToday(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
