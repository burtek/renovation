import { format } from 'date-fns';
import { useEffect, useState } from 'react';

import { useApp } from '../../contexts/AppContext';
import type { CalendarEvent, CalendarEventType, Expense } from '../../types';
import { formatPLN } from '../../utils/format';

import type { EventFormData } from './EventModal';
import EventModal from './EventModal';
import MonthCalendar from './MonthCalendar';


const EVENT_TYPE_COLOR: Record<CalendarEventType, string> = {
    event: '#3B82F6',
    'own work': '#10B981',
    'visit/measurements': '#F59E0B',
    'contractor work': '#8B5CF6'
};

const EXPENSE_COLOR = '#EF4444';

const emptyForm: EventFormData = {
    title: '',
    startDate: '',
    endDate: '',
    contractor: '',
    eventType: 'event',
    notes: ''
};

interface CalEventItem {
    title: string;
    start: Date;
    end: Date;
    resource: CalendarEvent;
}

interface CalExpenseItem {
    title: string;
    start: Date;
    end: Date;
    resource: Expense;
}

type CalItem = CalEventItem | CalExpenseItem;

function isExpenseItem(item: CalItem): item is CalExpenseItem {
    return !('eventType' in item.resource);
}

function buildAllDayRange(startDate: string, endDate?: string): { start: Date; end: Date } {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate && endDate > startDate ? endDate : startDate}T00:00:00`);
    return { start, end };
}

function formatExpenseTitle(expense: Expense): string {
    return `💶 ${formatPLN(expense.price)} - ${expense.description}`;
}

function EventComponent({ event }: { event: CalItem }) {
    const isExpense = isExpenseItem(event);
    return (
        <div className="overflow-hidden">
            <div className="truncate">{event.title}</div>
            {!isExpense && event.resource.contractor
                && <div className="truncate text-xs opacity-80">{event.resource.contractor}</div>}
        </div>
    );
}

interface Props {
    /** Override the initial displayed month — useful in tests. Defaults to today. */
    defaultDate?: Date;
}

export default function CalendarPage({ defaultDate }: Props) {
    const { state, dispatch } = useApp();
    const [modal, setModal] = useState<{ open: boolean; editEvent?: CalendarEvent }>({ open: false });
    const [form, setForm] = useState(emptyForm);

    const contractorNames = Array.from(new Set(
        state.calendarEvents.map(e => e.contractor).filter((c): c is string => Boolean(c))
    ));

    useEffect(() => {
        document.title = 'Calendar | Renovation';
    }, []);

    const calItems: CalItem[] = state.calendarEvents.map(e => {
        const { start, end } = buildAllDayRange(e.date, e.endDate);
        return { title: e.title, start, end, resource: e };
    });

    const expenseItems: CalItem[] = state.expenses
        .filter(e => {
            if (!e.date) {
                return false;
            }
            const d = new Date(`${e.date}T00:00:00`);
            return !isNaN(d.getTime());
        })
        .map(e => {
            const { start, end } = buildAllDayRange(e.date);
            return { title: formatExpenseTitle(e), start, end, resource: e };
        });

    const events: CalItem[] = [...calItems, ...expenseItems];

    const eventPropGetter = (event: CalItem) => {
        const color = isExpenseItem(event) ? EXPENSE_COLOR : EVENT_TYPE_COLOR[event.resource.eventType];
        return { style: { backgroundColor: color, borderColor: color } };
    };

    const handleSelectSlot = ({ start }: { start: Date; end: Date }) => {
        const startDate = format(start, 'yyyy-MM-dd');
        setForm({ ...emptyForm, startDate });
        setModal({ open: true });
    };

    const handleSelectEvent = (event: CalItem) => {
        if (isExpenseItem(event)) {
            return;
        }
        const e = event.resource;
        setForm({
            title: e.title,
            startDate: e.date,
            endDate: e.endDate ?? '',
            contractor: e.contractor ?? '',
            eventType: e.eventType,
            notes: e.notes ?? ''
        });
        setModal({ open: true, editEvent: e });
    };

    const save = () => {
        if (!form.title.trim() || !form.startDate) {
            return;
        }
        const data: Omit<CalendarEvent, 'id'> = {
            title: form.title,
            date: form.startDate,
            endDate: form.endDate && form.endDate > form.startDate ? form.endDate : undefined,
            contractor: form.contractor || undefined,
            eventType: form.eventType,
            notes: form.notes || undefined
        };
        if (modal.editEvent) {
            dispatch({ type: 'UPDATE_CALENDAR_EVENT', payload: { ...modal.editEvent, ...data } });
        } else {
            dispatch({ type: 'ADD_CALENDAR_EVENT', payload: data });
        }
        setModal({ open: false });
    };

    const del = () => {
        // eslint-disable-next-line no-alert
        if (modal.editEvent && confirm('Delete event?')) {
            dispatch({ type: 'DELETE_CALENDAR_EVENT', payload: modal.editEvent.id });
            setModal({ open: false });
        }
    };

    return (
        <div className="h-full flex flex-col p-4">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Calendar</h1>
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-4 min-h-0">
                <MonthCalendar
                    events={events}
                    style={{ height: '100%' }}
                    onSelectSlot={handleSelectSlot}
                    onSelectEvent={handleSelectEvent}
                    eventPropGetter={eventPropGetter}
                    components={{ event: EventComponent }}
                    defaultDate={defaultDate}
                />
            </div>

            {modal.open && (
                <EventModal
                    editEvent={modal.editEvent}
                    form={form}
                    contractorNames={contractorNames}
                    onFormChange={update => {
                        setForm(f => ({ ...f, ...update }));
                    }}
                    onSave={save}
                    onDelete={del}
                    onClose={() => {
                        setModal({ open: false });
                    }}
                />
            )}
        </div>
    );
}
