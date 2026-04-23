import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { useEffect, useState } from 'react';
import type { SlotInfo } from 'react-big-calendar';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import type { EventInteractionArgs } from 'react-big-calendar/lib/addons/dragAndDrop';
import withDragAndDropCjs from 'react-big-calendar/lib/addons/dragAndDrop';

import { useApp } from '../../contexts/AppContext';
import type { CalendarEvent, CalendarEventType, Expense } from '../../types';
import { formatPLN } from '../../utils/format';

import type { EventFormData } from './EventModal';
import EventModal from './EventModal';


const locales = { 'en-US': enUS };
const startOfWeekMonday: typeof startOfWeek = (date, options) => startOfWeek(date, { ...options, weekStartsOn: 1 });
const localizer = dateFnsLocalizer({ format, parse, startOfWeek: startOfWeekMonday, getDay, locales });

// Vite 8 (Rolldown) production builds double-wrap CJS modules with __esModule:true,
// leaving the module object (not the function) as the default export. Unwrap manually.
type WithDragAndDropFn = typeof withDragAndDropCjs;
const withDragAndDropMod = withDragAndDropCjs as WithDragAndDropFn | { default: WithDragAndDropFn };
const withDragAndDrop: WithDragAndDropFn = typeof withDragAndDropMod === 'function'
    ? withDragAndDropMod
    : withDragAndDropMod.default;

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

interface BigCalEvent {
    title: string;
    start: Date;
    end: Date;
    allDay: boolean;
    resource: CalendarEvent;
}

interface BigCalExpenseItem {
    title: string;
    start: Date;
    end: Date;
    allDay: boolean;
    draggable?: false;
    resource: Expense;
}

type BigCalItem = BigCalEvent | BigCalExpenseItem;

function isExpenseItem(item: BigCalItem): item is BigCalExpenseItem {
    return !('eventType' in item.resource);
}

function allDayEventDates(startDate: string, endDate?: string): { start: Date; end: Date } {
    const start = new Date(`${startDate}T00:00:00`);
    // end is exclusive in react-big-calendar for allDay events → add 1 day
    const endDay = endDate && endDate > startDate ? endDate : startDate;
    const end = new Date(`${endDay}T00:00:00`);
    end.setDate(end.getDate() + 1);
    return { start, end };
}

function formatExpenseTitle(expense: Expense): string {
    return `💶 ${formatPLN(expense.price)} - ${expense.description}`;
}

function EventComponent({ event }: { event: BigCalItem }) {
    const isExpense = isExpenseItem(event);
    return (
        <div className="overflow-hidden">
            <div className="truncate">{event.title}</div>
            {!isExpense && event.resource.contractor
                && <div className="truncate text-xs opacity-80">{event.resource.contractor}</div>}
        </div>
    );
}

const DnDCalendar = withDragAndDrop<BigCalItem>(Calendar);

export default function CalendarPage() {
    const { state, dispatch } = useApp();
    const [modal, setModal] = useState<{ open: boolean; editEvent?: CalendarEvent }>({ open: false });
    const [form, setForm] = useState(emptyForm);

    const contractorNames = Array.from(new Set(state.calendarEvents.map(e => e.contractor).filter((c): c is string => Boolean(c))));

    useEffect(() => {
        document.title = 'Calendar | Renovation';
    }, []);

    const calEvents: BigCalItem[] = state.calendarEvents.map(e => {
        const { start, end } = allDayEventDates(e.date, e.endDate);
        return { title: e.title, start, end, allDay: true, resource: e };
    });

    const expenseEvents: BigCalItem[] = state.expenses.map(e => {
        const { start, end } = allDayEventDates(e.date);
        return { title: formatExpenseTitle(e), start, end, allDay: true, draggable: false, resource: e };
    });

    const events: BigCalItem[] = [...calEvents, ...expenseEvents];

    const eventPropGetter = (event: BigCalItem) => {
        const color = isExpenseItem(event) ? EXPENSE_COLOR : EVENT_TYPE_COLOR[event.resource.eventType];
        return { style: { backgroundColor: color, borderColor: color } };
    };

    const handleSelectSlot = (slot: SlotInfo) => {
        const startDate = format(slot.start, 'yyyy-MM-dd');
        // slot.end is exclusive – subtract 1 day to get the inclusive end date
        const slotEnd = new Date(slot.end);
        slotEnd.setDate(slotEnd.getDate() - 1);
        const slotEndDate = format(slotEnd, 'yyyy-MM-dd');
        setForm({ ...emptyForm, startDate, endDate: slotEndDate > startDate ? slotEndDate : '' });
        setModal({ open: true });
    };

    const handleSelectEvent = (event: BigCalItem) => {
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

    const updateEventDates = ({ event, start, end }: EventInteractionArgs<BigCalItem>) => {
        if (isExpenseItem(event)) {
            return;
        }
        const newStart = format(new Date(start), 'yyyy-MM-dd');
        // end is exclusive in react-big-calendar for allDay events → subtract 1 day
        const endDate = new Date(end);
        endDate.setDate(endDate.getDate() - 1);
        const newEnd = format(endDate, 'yyyy-MM-dd');
        dispatch({
            type: 'UPDATE_CALENDAR_EVENT',
            payload: {
                ...event.resource,
                date: newStart,
                endDate: newEnd > newStart ? newEnd : undefined
            }
        });
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
                <DnDCalendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: '100%' }}
                    onSelectSlot={handleSelectSlot}
                    onSelectEvent={handleSelectEvent}
                    onEventDrop={updateEventDates}
                    onEventResize={updateEventDates}
                    eventPropGetter={eventPropGetter}
                    selectable
                    resizable
                    views={['month', 'week', 'day']}
                    defaultView="month"
                    components={{ event: EventComponent }}
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
