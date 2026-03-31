import type { CalendarEvent, CalendarEventType } from '../../types';


const EVENT_TYPES: { label: string; value: CalendarEventType }[] = [
    { label: 'Event', value: 'event' },
    { label: 'Own work', value: 'own work' },
    { label: 'Visit / measurements', value: 'visit/measurements' },
    { label: 'Contractor work', value: 'contractor work' }
];

export interface EventFormData {
    title: string;
    startDate: string;
    endDate: string;
    contractor: string;
    eventType: CalendarEventType;
    notes: string;
}

interface Props {
    editEvent: CalendarEvent | undefined;
    form: EventFormData;
    contractorNames: string[];
    onFormChange: (update: Partial<EventFormData>) => void;
    onSave: () => void;
    onDelete: () => void;
    onClose: () => void;
}

export default function EventModal({ editEvent, form, contractorNames, onFormChange, onSave, onDelete, onClose }: Props) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl max-h-screen overflow-y-auto">
                <h2 className="text-lg font-bold mb-4 dark:text-gray-100">{editEvent ? 'Edit Event' : 'New Event'}</h2>
                <div className="space-y-3">
                    <input
                        placeholder="Title *"
                        value={form.title}
                        onChange={e => {
                            onFormChange({ title: e.target.value });
                        }}
                        className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 dark:text-gray-100"
                    />
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Start date *</label>
                            <input
                                type="date"
                                value={form.startDate}
                                onChange={e => {
                                    onFormChange({ startDate: e.target.value });
                                }}
                                className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 dark:text-gray-100"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">End date</label>
                            <input
                                type="date"
                                value={form.endDate}
                                min={form.startDate}
                                onChange={e => {
                                    onFormChange({ endDate: e.target.value });
                                }}
                                className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 dark:text-gray-100"
                            />
                        </div>
                    </div>
                    <input
                        list="contractor-suggestions"
                        placeholder="Contractor"
                        value={form.contractor}
                        onChange={e => {
                            onFormChange({ contractor: e.target.value });
                        }}
                        className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 dark:text-gray-100"
                    />
                    <datalist id="contractor-suggestions">
                        {contractorNames.map(name => (
                            <option
                                key={name}
                                value={name}
                            />
                        ))}
                    </datalist>
                    <div>
                        <label
                            htmlFor="event-type"
                            className="text-xs text-gray-500 dark:text-gray-400 mb-1 block"
                        >Event type
                        </label>
                        <select
                            id="event-type"
                            value={form.eventType}
                            onChange={e => {
                                const found = EVENT_TYPES.find(t => t.value === e.target.value);
                                if (found) {
                                    onFormChange({ eventType: found.value });
                                }
                            }}
                            className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 dark:text-gray-100"
                        >
                            {EVENT_TYPES.map(t => (
                                <option
                                    key={t.value}
                                    value={t.value}
                                >
                                    {t.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <textarea
                        placeholder="Notes"
                        value={form.notes}
                        onChange={e => {
                            onFormChange({ notes: e.target.value });
                        }}
                        className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm h-20 focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 dark:text-gray-100"
                    />
                </div>
                <div className="flex gap-2 mt-4">
                    {editEvent && (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                        >Delete
                        </button>
                    )}
                    <div className="ml-auto flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                        >Cancel
                        </button>
                        <button
                            type="button"
                            onClick={onSave}
                            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                        >Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
