import {
    addDays,
    addMonths,
    differenceInCalendarDays,
    endOfDay,
    format,
    isAfter,
    isBefore,
    isSameMonth,
    isToday,
    startOfDay,
    startOfMonth,
    startOfWeek,
    subMonths
} from 'date-fns';
import type { ComponentType } from 'react';
import { createElement, useRef, useState } from 'react';

import { cn } from '../../utils/classnames';


const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_PER_WEEK = DAY_LABELS.length;
const WEEKS_PER_GRID = 6;
const HEADER_HEIGHT = 28; // px — space for day number
const TRACK_HEIGHT = 22; // px — height of one event track
const TRACK_GAP = 2; // px — gap between tracks
const PER_TRACK_HEIGHT = TRACK_HEIGHT + TRACK_GAP;
const MIN_TRACK_COUNT = 1; // at least one empty track slot per row

/** Percentage width of one calendar column out of 100%. */
const CELL_PCT = 100 / DAYS_PER_WEEK;

export interface CalendarSlotInfo {
    start: Date;
    end: Date;
}

export interface CalendarEventBase {
    start: Date;
    end: Date;
}

interface PositionedEvent<T> {
    event: T;
    startCol: number;
    colSpan: number;
    track: number;
    continuesAfter: boolean;
    continuedFrom: boolean;
}

interface MonthCalendarProps<T extends CalendarEventBase> {
    events: T[];
    onSelectSlot?: (slot: CalendarSlotInfo) => void;
    onSelectEvent?: (event: T) => void;
    /** Called after the user drops an event on a new day. */
    onEventDrop?: (event: T, newStart: Date, newEnd: Date) => void;
    /** Called after the user drags the resize handle to a new end day. */
    onEventResize?: (event: T, newStart: Date, newEnd: Date) => void;
    eventPropGetter?: (event: T) => { style?: React.CSSProperties };
    components?: { event?: ComponentType<{ event: T }> };
    style?: React.CSSProperties;
    /** Override the initial displayed month, useful for testing. Defaults to today. */
    defaultDate?: Date;
}

// ---------------------------------------------------------------------------
// Grid computation
// ---------------------------------------------------------------------------

/** Returns a 6-row × 7-column grid of dates for the calendar month view. */
function getMonthWeeks(date: Date): Date[][] {
    const gridStart = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
    const weeks: Date[][] = [];
    for (let w = 0; w < WEEKS_PER_GRID; w++) {
        const week: Date[] = [];
        for (let d = 0; d < DAYS_PER_WEEK; d++) {
            week.push(addDays(gridStart, (w * DAYS_PER_WEEK) + d));
        }
        weeks.push(week);
    }
    return weeks;
}

// ---------------------------------------------------------------------------
// Event layout
// ---------------------------------------------------------------------------

function layoutWeekEvents<T extends CalendarEventBase>(
    events: T[],
    weekDays: Date[]
): PositionedEvent<T>[] {
    const weekStart = startOfDay(weekDays[0]);
    const weekEnd = endOfDay(weekDays[DAYS_PER_WEEK - 1]);

    const overlapping = events
        .filter(e =>
            !isAfter(startOfDay(e.start), weekEnd)
            && !isBefore(startOfDay(e.end), weekStart))
        // Multi-day events first (longest first), then by start date
        .sort((a, b) => {
            const aDur = differenceInCalendarDays(a.end, a.start);
            const bDur = differenceInCalendarDays(b.end, b.start);
            if (bDur !== aDur) {
                return bDur - aDur;
            }
            return a.start.getTime() - b.start.getTime();
        });

    const tracks = new Map<number, boolean[]>();
    const result: PositionedEvent<T>[] = [];
    const maxCol = DAYS_PER_WEEK - 1;

    for (const event of overlapping) {
        const startCol = Math.max(0, differenceInCalendarDays(startOfDay(event.start), weekStart));
        const endCol = Math.min(maxCol, differenceInCalendarDays(startOfDay(event.end), weekStart));

        // Greedy track assignment: find first track where all required columns are free
        let track = 0;
        for (;;) {
            let trackRow = tracks.get(track);
            if (trackRow === undefined) {
                trackRow = new Array<boolean>(DAYS_PER_WEEK).fill(false);
                tracks.set(track, trackRow);
            }
            let free = true;
            for (let c = startCol; c <= endCol; c++) {
                if (trackRow[c]) {
                    free = false;
                    break;
                }
            }
            if (free) {
                break;
            }
            track++;
        }

        const row = tracks.get(track);
        if (row !== undefined) {
            for (let c = startCol; c <= endCol; c++) {
                row[c] = true;
            }
        }

        result.push({
            event,
            startCol,
            colSpan: (endCol - startCol) + 1,
            track,
            continuesAfter: isAfter(startOfDay(event.end), weekEnd),
            continuedFrom: isBefore(startOfDay(event.start), weekStart)
        });
    }

    return result;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MonthCalendar<T extends CalendarEventBase>({
    events,
    onSelectSlot,
    onSelectEvent,
    onEventDrop,
    onEventResize,
    eventPropGetter,
    components,
    style,
    defaultDate
}: MonthCalendarProps<T>) {
    const [currentDate, setCurrentDate] = useState(() => defaultDate ?? new Date());

    // ── DnD state ──────────────────────────────────────────────────────────
    // dragInfoRef holds the active drag payload without triggering re-renders on every dragover.
    const dragInfoRef = useRef<{ type: 'move' | 'resize'; event: T } | null>(null);
    // draggingEvent drives the opacity fade on the chip being dragged (one re-render on start/end).
    const [draggingEvent, setDraggingEvent] = useState<T | null>(null);
    // dragOverDate drives the highlight on the current drop-target cell.
    const [dragOverDate, setDragOverDate] = useState<string | null>(null);

    const weeks = getMonthWeeks(currentDate);
    const eventComp = components?.event;

    const handlePrev = () => {
        setCurrentDate(d => subMonths(d, 1));
    };
    const handleNext = () => {
        setCurrentDate(d => addMonths(d, 1));
    };
    const handleToday = () => {
        setCurrentDate(new Date());
    };

    const handleDayClick = (day: Date) => {
        onSelectSlot?.({ start: startOfDay(day), end: addDays(startOfDay(day), 1) });
    };

    // ── DnD handlers ───────────────────────────────────────────────────────

    const handleEventDragStart = (e: React.DragEvent, event: T) => {
        dragInfoRef.current = { type: 'move', event };
        setDraggingEvent(event);
    };

    const handleResizeDragStart = (e: React.DragEvent, event: T) => {
        e.stopPropagation();
        dragInfoRef.current = { type: 'resize', event };
        setDraggingEvent(event);
    };

    const handleDragEnd = () => {
        dragInfoRef.current = null;
        setDraggingEvent(null);
        setDragOverDate(null);
    };

    const handleDayDragOver = (e: React.DragEvent, dateStr: string) => {
        if (!dragInfoRef.current) {
            return;
        }
        e.preventDefault();
        if (dateStr !== dragOverDate) {
            setDragOverDate(dateStr);
        }
    };

    const handleDayDrop = (e: React.DragEvent, day: Date) => {
        e.preventDefault();
        const info = dragInfoRef.current;
        if (!info) {
            return;
        }

        if (info.type === 'move') {
            const newStart = startOfDay(day);
            const durationDays = differenceInCalendarDays(info.event.end, info.event.start);
            const newEnd = addDays(newStart, durationDays);
            onEventDrop?.(info.event, newStart, newEnd);
        } else {
            const newStart = startOfDay(info.event.start);
            const newEnd = startOfDay(day);
            if (newEnd >= newStart) {
                onEventResize?.(info.event, newStart, newEnd);
            }
        }

        dragInfoRef.current = null;
        setDraggingEvent(null);
        setDragOverDate(null);
    };

    return (
        <div
            className="flex flex-col h-full select-none"
            style={style}
        >
            {/* ── Header ── */}
            <div className="flex items-center gap-1 mb-3 shrink-0">
                <button
                    type="button"
                    onClick={handlePrev}
                    aria-label="Previous month"
                    className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-lg leading-none"
                >
                    ‹
                </button>
                <button
                    type="button"
                    onClick={handleNext}
                    aria-label="Next month"
                    className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-lg leading-none"
                >
                    ›
                </button>
                <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 min-w-[140px] text-center">
                    {format(currentDate, 'MMMM yyyy')}
                </h2>
                <button
                    type="button"
                    onClick={handleToday}
                    className="ml-auto px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                >
                    Today
                </button>
            </div>

            {/* ── Day-of-week labels ── */}
            <div className="grid grid-cols-7 shrink-0 border-b border-t border-gray-200 dark:border-gray-700">
                {DAY_LABELS.map(label => (
                    <div
                        key={label}
                        className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1"
                    >
                        {label}
                    </div>
                ))}
            </div>

            {/* ── Week rows ── */}
            <div className="flex-1 overflow-y-auto">
                {weeks.map(week => {
                    const positionedEvents = layoutWeekEvents(events, week);

                    // Dynamic height: grow to fit all event tracks — no overflow cutoff
                    const trackCount = positionedEvents.reduce(
                        (max, pe) => Math.max(max, pe.track + MIN_TRACK_COUNT),
                        MIN_TRACK_COUNT
                    );
                    const rowHeight = HEADER_HEIGHT + (trackCount * PER_TRACK_HEIGHT);

                    return (
                        <div
                            key={week[0].toISOString()}
                            className="relative border-b border-gray-200 dark:border-gray-700"
                            style={{ height: `${rowHeight}px` }}
                        >
                            {/* Clickable day-cell backgrounds — also act as DnD drop targets */}
                            <div className="absolute inset-0 grid grid-cols-7">
                                {week.map(day => {
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    return (
                                        <div
                                            key={day.toISOString()}
                                            data-testid={`calendar-day-${dateStr}`}
                                            className={cn(
                                                'border-r border-gray-200 dark:border-gray-700',
                                                'cursor-pointer transition-colors',
                                                'hover:bg-gray-100 dark:hover:bg-gray-700',
                                                !isSameMonth(day, currentDate) && 'bg-gray-50 dark:bg-gray-900',
                                                isToday(day) && 'bg-blue-50/40 dark:bg-blue-900/20',
                                                // Drop-target highlight while dragging
                                                dragOverDate === dateStr && 'bg-blue-100 dark:bg-blue-900/40'
                                            )}
                                            onClick={() => {
                                                handleDayClick(day);
                                            }}
                                            onDragOver={e => {
                                                handleDayDragOver(e, dateStr);
                                            }}
                                            onDrop={e => {
                                                handleDayDrop(e, day);
                                            }}
                                        />
                                    );
                                })}
                            </div>

                            {/* Day numbers (pointer-events-none so clicks fall through to backgrounds) */}
                            <div
                                className="relative grid grid-cols-7 pointer-events-none"
                                style={{ height: `${HEADER_HEIGHT}px` }}
                            >
                                {week.map(day => (
                                    <div
                                        key={day.toISOString()}
                                        className="pt-1 pr-1 text-right"
                                    >
                                        <span className={cn(
                                            'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs',
                                            isToday(day) && 'bg-blue-500 text-white font-semibold',
                                            !isToday(day) && isSameMonth(day, currentDate) && 'text-gray-700 dark:text-gray-200',
                                            !isToday(day) && !isSameMonth(day, currentDate) && 'text-gray-400 dark:text-gray-600'
                                        )}
                                        >
                                            {format(day, 'd')}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Event chips — all tracks rendered, no overflow cutoff */}
                            {positionedEvents.map(pe => {
                                const eventStyle = eventPropGetter ? eventPropGetter(pe.event).style ?? {} : {};
                                const isDraggingThis = draggingEvent === pe.event;
                                return (
                                    <div
                                        key={`${pe.event.start.toISOString()}-${pe.event.end.toISOString()}-${pe.track}`}
                                        className={cn(
                                            'absolute px-0.5 z-10',
                                            // Pass pointer events through to day-cell backgrounds while ANY drag is active
                                            // so dragover/drop fire on the correct day cell, not on event chips.
                                            draggingEvent !== null && 'pointer-events-none'
                                        )}
                                        style={{
                                            top: HEADER_HEIGHT + (pe.track * PER_TRACK_HEIGHT),
                                            left: `${pe.startCol * CELL_PCT}%`,
                                            width: `${pe.colSpan * CELL_PCT}%`
                                        }}
                                    >
                                        <button
                                            type="button"
                                            draggable={onEventDrop !== undefined}
                                            onClick={e => {
                                                e.stopPropagation();
                                                onSelectEvent?.(pe.event);
                                            }}
                                            onDragStart={e => {
                                                handleEventDragStart(e, pe.event);
                                            }}
                                            onDragEnd={handleDragEnd}
                                            className={cn(
                                                'relative w-full text-left text-xs rounded px-1 py-0.5 text-white truncate block leading-4',
                                                'cursor-grab active:cursor-grabbing',
                                                pe.continuedFrom && 'rounded-l-none pl-0',
                                                pe.continuesAfter && 'rounded-r-none',
                                                isDraggingThis && 'opacity-40'
                                            )}
                                            style={{ height: `${TRACK_HEIGHT}px`, ...eventStyle }}
                                        >
                                            {eventComp ? createElement(eventComp, { event: pe.event }) : null}
                                            {/* Resize handle — only on the trailing edge of the event */}
                                            {onEventResize !== undefined && !pe.continuesAfter && (
                                                <div
                                                    data-testid="event-resize-handle"
                                                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-black/20 rounded-r"
                                                    draggable
                                                    onDragStart={e => {
                                                        handleResizeDragStart(e, pe.event);
                                                    }}
                                                    onDragEnd={e => {
                                                        e.stopPropagation();
                                                        handleDragEnd();
                                                    }}
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                    }}
                                                />
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
