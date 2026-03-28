import React, { useState } from 'react';
import { Calendar, dateFnsLocalizer, SlotInfo } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { useApp } from '../contexts/AppContext';
import { CalendarEvent } from '../types';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

interface EventFormData {
  title: string;
  date: string;
  contractor: string;
  workType: string;
  notes: string;
}

const emptyForm: EventFormData = { title: '', date: '', contractor: '', workType: '', notes: '' };

interface BigCalEvent {
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: CalendarEvent;
}

export default function CalendarPage() {
  const { state, dispatch } = useApp();
  const [modal, setModal] = useState<{ open: boolean; editEvent?: CalendarEvent; date?: string }>({ open: false });
  const [form, setForm] = useState<EventFormData>(emptyForm);

  const events: BigCalEvent[] = state.calendarEvents.map(e => ({
    title: e.title,
    start: new Date(e.date + 'T00:00:00'),
    end: new Date(e.date + 'T23:59:59'),
    allDay: true,
    resource: e,
  }));

  const handleSelectSlot = (slot: SlotInfo) => {
    const date = format(slot.start, 'yyyy-MM-dd');
    setForm({ ...emptyForm, date });
    setModal({ open: true, date });
  };

  const handleSelectEvent = (event: BigCalEvent) => {
    const e = event.resource;
    setForm({ title: e.title, date: e.date, contractor: e.contractor ?? '', workType: e.workType, notes: e.notes ?? '' });
    setModal({ open: true, editEvent: e });
  };

  const save = () => {
    if (!form.title.trim()) return;
    const data = { title: form.title, date: form.date, contractor: form.contractor || undefined, workType: form.workType, notes: form.notes || undefined };
    if (modal.editEvent) {
      dispatch({ type: 'UPDATE_CALENDAR_EVENT', payload: { ...modal.editEvent, ...data } });
    } else {
      dispatch({ type: 'ADD_CALENDAR_EVENT', payload: data });
    }
    setModal({ open: false });
  };

  const del = () => {
    if (modal.editEvent && confirm('Delete event?')) {
      dispatch({ type: 'DELETE_CALENDAR_EVENT', payload: modal.editEvent.id });
      setModal({ open: false });
    }
  };

  return (
    <div className="h-full flex flex-col p-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Calendar</h1>
      <div className="flex-1 bg-white rounded-lg shadow-sm border p-4 min-h-0">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent as (event: object) => void}
          selectable
          views={['month', 'week', 'day']}
          defaultView="month"
        />
      </div>

      {modal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4">{modal.editEvent ? 'Edit Event' : 'New Event'}</h2>
            <div className="space-y-3">
              <input placeholder="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              <input placeholder="Contractor" value={form.contractor} onChange={e => setForm(f => ({ ...f, contractor: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              <input placeholder="Work type" value={form.workType} onChange={e => setForm(f => ({ ...f, workType: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              <textarea placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm h-20 focus:outline-none focus:border-blue-400" />
            </div>
            <div className="flex gap-2 mt-4">
              {modal.editEvent && <button onClick={del} className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600">Delete</button>}
              <div className="ml-auto flex gap-2">
                <button onClick={() => setModal({ open: false })} className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                <button onClick={save} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
