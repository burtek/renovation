import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { useState } from 'react';
import type { SlotInfo } from 'react-big-calendar';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';

import { useApp } from '../contexts/AppContext';
import type { CalendarEvent } from '../types';
import 'react-big-calendar/lib/css/react-big-calendar.css';


const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const EVENT_COLORS = [
    { label: 'Blue', value: '#3B82F6' },
    { label: 'Green', value: '#10B981' },
    { label: 'Yellow', value: '#F59E0B' },
    { label: 'Red', value: '#EF4444' },
    { label: 'Purple', value: '#8B5CF6' },
    { label: 'Pink', value: '#EC4899' },
    { label: 'Teal', value: '#14B8A6' },
    { label: 'Orange', value: '#F97316' }
];

interface EventFormData {
    title: string;
    startDate: string;
    endDate: string;
    contractor: string;
    workType: string;
    notes: string;
    color: string;
}

const emptyForm: EventFormData = {
    title: '',
    startDate: '',
    endDate: '',
    contractor: '',
    workType: '',
    notes: '',
    color: ''
};

interface BigCalEvent {
    title: string;
    start: Date;
    end: Date;
    allDay: boolean;
    resource: CalendarEvent;
}

export default function CalendarPage() {
    const { state, dispatch } = useApp();
    const [modal, setModal] = useState<{ open: boolean; editEvent?: CalendarEvent }>({ open: false });
    const [form, setForm] = useState<EventFormData>(emptyForm);

    const events: BigCalEvent[] = state.calendarEvents.map(e => {
        const start = new Date(`${e.date}T00:00:00`);
        // end is exclusive in react-big-calendar for allDay events → add 1 day
        const endDay = e.endDate && e.endDate > e.date ? e.endDate : e.date;
        const end = new Date(`${endDay}T00:00:00`);
        end.setDate(end.getDate() + 1);
        return { title: e.title, start, end, allDay: true, resource: e };
    });

    const eventPropGetter = (event: BigCalEvent) => {
        const { color } = event.resource;
        if (!color) {
            return {};
        }
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

    const handleSelectEvent = (event: BigCalEvent) => {
        const e = event.resource;
        setForm({
            title: e.title,
            startDate: e.date,
            endDate: e.endDate ?? '',
            contractor: e.contractor ?? '',
            workType: e.workType,
            notes: e.notes ?? '',
            color: e.color ?? ''
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
            workType: form.workType,
            notes: form.notes || undefined,
            color: form.color || undefined
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
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Calendar</h1>
            <div className="flex-1 bg-white rounded-lg shadow-sm border p-4 min-h-0">
                <Calendar<BigCalEvent>
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: '100%' }}
                    onSelectSlot={handleSelectSlot}
                    onSelectEvent={handleSelectEvent}
                    eventPropGetter={eventPropGetter}
                    selectable
                    views={['month', 'week', 'day']}
                    defaultView="month"
                />
            </div>

            {modal.open && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl max-h-screen overflow-y-auto">
                        <h2 className="text-lg font-bold mb-4">{modal.editEvent ? 'Edit Event' : 'New Event'}</h2>
                        <div className="space-y-3">
                            <input
                                placeholder="Title *"
                                value={form.title}
                                onChange={e => {
                                    setForm(f => ({ ...f, title: e.target.value }));
                                }}
                                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                            />
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="text-xs text-gray-500 mb-1 block">Start date *</label>
                                    <input
                                        type="date"
                                        value={form.startDate}
                                        onChange={e => {
                                            setForm(f => ({ ...f, startDate: e.target.value }));
                                        }}
                                        className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs text-gray-500 mb-1 block">End date</label>
                                    <input
                                        type="date"
                                        value={form.endDate}
                                        min={form.startDate}
                                        onChange={e => {
                                            setForm(f => ({ ...f, endDate: e.target.value }));
                                        }}
                                        className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                                    />
                                </div>
                            </div>
                            <input
                                placeholder="Contractor"
                                value={form.contractor}
                                onChange={e => {
                                    setForm(f => ({ ...f, contractor: e.target.value }));
                                }}
                                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                            />
                            <input
                                placeholder="Work type"
                                value={form.workType}
                                onChange={e => {
                                    setForm(f => ({ ...f, workType: e.target.value }));
                                }}
                                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                            />
                            <textarea
                                placeholder="Notes"
                                value={form.notes}
                                onChange={e => {
                                    setForm(f => ({ ...f, notes: e.target.value }));
                                }}
                                className="w-full border rounded px-3 py-2 text-sm h-20 focus:outline-none focus:border-blue-400"
                            />
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Event colour</label>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setForm(f => ({ ...f, color: '' }));
                                        }}
                                        className={`w-7 h-7 rounded-full border-2 bg-gray-200 ${form.color ? 'border-transparent' : 'border-gray-800 scale-110'}`}
                                        title="Default"
                                    />
                                    {EVENT_COLORS.map(c => (
                                        <button
                                            key={c.value}
                                            type="button"
                                            onClick={() => {
                                                setForm(f => ({ ...f, color: c.value }));
                                            }}
                                            className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c.value ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                                            style={{ backgroundColor: c.value }}
                                            title={c.label}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            {modal.editEvent && (
                                <button
                                    type="button"
                                    onClick={del}
                                    className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                                >Delete
                                </button>
                            )}
                            <div className="ml-auto flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setModal({ open: false });
                                    }}
                                    className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300"
                                >Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={save}
                                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                                >Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
