import { addDays } from 'date-fns';
import { format } from 'date-fns/format';
import type { CSSProperties, ComponentType, MouseEvent } from 'react';
import { createElement } from 'react';


// Minimal event shape needed by this view
interface RbcEvent {
    title: string;
    start: Date;
    end: Date;
    resource: { id: string };
}

// Minimal localizer interface (date-fns localizer from react-big-calendar)
interface RbcLocalizer {
    firstVisibleDay: (date: Date, localizer: RbcLocalizer) => Date;
    lastVisibleDay: (date: Date, localizer: RbcLocalizer) => Date;
    add: (date: Date, amount: number, unit: string) => Date;
    isSameDate: (a: Date, b: Date) => boolean;
    format: (date: Date, formatStr: string, culture?: string) => string;
}

interface SlotInfo {
    start: Date;
    end: Date;
    slots: Date[];
    action: string;
}

interface CustomMonthViewProps<T extends RbcEvent = RbcEvent> {
    date: Date;
    events: T[];
    localizer: RbcLocalizer;
    getNow: () => Date;
    onSelectEvent: (event: T, e: MouseEvent) => void;
    onSelectSlot: (slotInfo: SlotInfo) => void;
    eventPropGetter?: (event: T) => { style?: CSSProperties; className?: string };
    components?: { event?: ComponentType<{ event: T }> };
}

function getEventsForDay<T extends RbcEvent>(events: T[], day: Date): T[] {
    return events.filter(e => day >= new Date(e.start) && day < new Date(e.end));
}

function buildWeeks(localizer: RbcLocalizer, date: Date): Date[][] {
    const start = localizer.firstVisibleDay(date, localizer);
    const end = localizer.lastVisibleDay(date, localizer);
    const weeks: Date[][] = [];
    let current = start;
    while (current <= end) {
        const week: Date[] = [];
        for (let i = 0; i < 7; i++) {
            week.push(current);
            current = addDays(current, 1);
        }
        weeks.push(week);
    }
    return weeks;
}

function CustomMonthView<T extends RbcEvent = RbcEvent>({
    date,
    events,
    localizer,
    getNow,
    onSelectEvent,
    onSelectSlot,
    eventPropGetter,
    components
}: CustomMonthViewProps<T>) {
    const today = getNow();
    const weeks = buildWeeks(localizer, date);
    const [headerDays] = weeks;
    const eventComp = components?.event;

    return (
        <div
            className="rbc-month-view"
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        >
            {/* Day-name header row */}
            <div
                className="rbc-month-header"
                style={{ display: 'flex' }}
            >
                {headerDays.map(day => (
                    <div
                        key={day.toISOString()}
                        className="rbc-header"
                    >
                        {format(day, 'EEE')}
                    </div>
                ))}
            </div>

            {/* Week rows */}
            {weeks.map(week => (
                <div
                    key={week[0].toISOString()}
                    className="rbc-month-row"
                    style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'visible', height: 'auto' }}
                >
                    {week.map(day => {
                        const dayEvents = getEventsForDay(events, day);
                        const isToday = localizer.isSameDate(day, today);
                        const isOffRange = !localizer.isSameDate(
                            new Date(day.getFullYear(), day.getMonth(), 1),
                            new Date(date.getFullYear(), date.getMonth(), 1)
                        );

                        return (
                            <div
                                key={day.toISOString()}
                                className={[
                                    'rbc-day-bg',
                                    isToday ? 'rbc-today' : '',
                                    isOffRange ? 'rbc-off-range-bg' : ''
                                ].filter(Boolean).join(' ')}
                                style={{
                                    flex: '1 0 0%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden',
                                    position: 'relative'
                                }}
                                onClick={() => {
                                    onSelectSlot({
                                        start: day,
                                        end: addDays(day, 1),
                                        slots: [day],
                                        action: 'click'
                                    });
                                }}
                            >
                                {/* Date number */}
                                <div
                                    className={[
                                        'rbc-date-cell',
                                        isToday ? 'rbc-now' : '',
                                        isOffRange ? 'rbc-off-range' : ''
                                    ].filter(Boolean).join(' ')}
                                    style={{ flex: 'none', padding: '2px 5px' }}
                                >
                                    {format(day, 'd')}
                                </div>

                                {/* Per-day scrollable event list */}
                                <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                                    {dayEvents.map(event => {
                                        const eventProps = eventPropGetter?.(event) ?? {};
                                        return (
                                            <div
                                                key={event.resource.id}
                                                className="rbc-event"
                                                style={{
                                                    display: 'block',
                                                    margin: '1px 2px',
                                                    padding: '1px 4px',
                                                    cursor: 'pointer',
                                                    ...eventProps.style
                                                }}
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    onSelectEvent(event, e);
                                                }}
                                            >
                                                <div className="rbc-event-content">
                                                    {eventComp
                                                        ? createElement(eventComp, { event })
                                                        : event.title}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

CustomMonthView.range = (date: Date, { localizer }: { localizer: RbcLocalizer }) => {
    const start = localizer.firstVisibleDay(date, localizer);
    const end = localizer.lastVisibleDay(date, localizer);
    return { start, end };
};

CustomMonthView.navigate = (date: Date, action: string, { localizer }: { localizer: RbcLocalizer }) => {
    switch (action) {
        case 'PREV': return localizer.add(date, -1, 'month');
        case 'NEXT': return localizer.add(date, 1, 'month');
        default: return date;
    }
};

CustomMonthView.title = (date: Date) => format(date, 'MMMM yyyy');

export default CustomMonthView;
