import type { Task } from '../../types';

import { MS_PER_DAY } from './types';


interface GanttRow {
    id: string;
    label: string;
    isSubtask: boolean;
    startDate: string;
    endDate: string;
    completed: boolean;
    assignee?: string;
    dependsOn: string[];
}

const ganttBarColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const ROW_HEIGHT = 36;
const LABEL_WIDTH = 220;
const HEADER_HEIGHT = 20;
const MIN_DAY_WIDTH = 20;
const MAX_DAY_WIDTH = 40;
const CHART_TARGET_WIDTH = 800;
const MARGIN_DAYS = 1;

export default function GanttChart({ tasks }: { tasks: Task[] }) {
    const rows: GanttRow[] = [];
    for (const task of tasks) {
        if (task.startDate && task.endDate) {
            rows.push({
                id: task.id,
                label: task.title,
                isSubtask: false,
                startDate: task.startDate,
                endDate: task.endDate,
                completed: task.completed,
                assignee: task.assignee,
                dependsOn: task.dependsOn ?? []
            });
        }
        for (const sub of task.subtasks) {
            if (sub.startDate && sub.endDate) {
                rows.push({
                    id: sub.id,
                    label: sub.title,
                    isSubtask: true,
                    startDate: sub.startDate,
                    endDate: sub.endDate,
                    completed: sub.completed,
                    assignee: sub.assignee,
                    dependsOn: sub.dependsOn ?? []
                });
            }
        }
    }

    if (rows.length === 0) {
        return (
            <div className="text-center text-gray-400 dark:text-gray-500 py-16">
                No tasks or subtasks with start and end dates to display in Gantt chart.
            </div>
        );
    }

    const parsedDates = rows.map(r => ({
        start: new Date(`${r.startDate}T00:00:00Z`),
        end: new Date(`${r.endDate}T00:00:00Z`)
    }));

    const minDate = new Date(Math.min(...parsedDates.map(d => d.start.getTime())));
    const maxDate = new Date(Math.max(...parsedDates.map(d => d.end.getTime())));
    minDate.setUTCDate(minDate.getUTCDate() - MARGIN_DAYS);
    maxDate.setUTCDate(maxDate.getUTCDate() + MARGIN_DAYS);
    const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / MS_PER_DAY);
    const dayWidth = Math.max(MIN_DAY_WIDTH, Math.min(MAX_DAY_WIDTH, CHART_TARGET_WIDTH / totalDays));
    const chartWidth = LABEL_WIDTH + (totalDays * dayWidth);
    const chartHeight = ((rows.length + 0.5) * ROW_HEIGHT) + HEADER_HEIGHT;

    const months: { label: string; x: number; width: number }[] = [];
    let cur = new Date(minDate);
    while (cur <= maxDate) {
        const monthEnd = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 0));
        const clampedEnd = monthEnd > maxDate ? maxDate : monthEnd;
        const dayOffset = Math.ceil((cur.getTime() - minDate.getTime()) / MS_PER_DAY);
        const dayCount = Math.ceil((clampedEnd.getTime() - cur.getTime()) / MS_PER_DAY) + 1;
        months.push({
            label: `${cur.toLocaleString('default', { month: 'short', timeZone: 'UTC' })} ${cur.getUTCFullYear()}`,
            x: LABEL_WIDTH + (dayOffset * dayWidth),
            width: dayCount * dayWidth
        });
        cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
    }

    const rowIndexMap = new Map(rows.map((r, i) => [r.id, i]));

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-auto">
            <svg
                width={chartWidth}
                height={chartHeight}
                className="font-sans text-xs"
            >
                <defs>
                    <marker
                        id="dep-arrow"
                        markerWidth="6"
                        markerHeight="5"
                        refX="6"
                        refY="2.5"
                        orient="auto"
                    >
                        <polygon
                            points="0 0, 6 2.5, 0 5"
                            fill="#6B7280"
                        />
                    </marker>
                </defs>

                {months.map((m, i) => (
                    <g key={m.label}>
                        <rect
                            x={m.x}
                            y={0}
                            width={m.width}
                            height={HEADER_HEIGHT}
                            fill={i % 2 === 0 ? '#F3F4F6' : '#E5E7EB'}
                        />
                        <text
                            x={m.x + (m.width / 2)}
                            y={14}
                            textAnchor="middle"
                            fontSize={10}
                            fill="#374151"
                        >{m.label}
                        </text>
                    </g>
                ))}

                {Array.from({ length: totalDays }).map((_, i) => {
                    const lineMs = minDate.getTime() + (i * MS_PER_DAY);
                    return (
                        <line
                            key={lineMs}
                            x1={LABEL_WIDTH + (i * dayWidth)}
                            y1={HEADER_HEIGHT}
                            x2={LABEL_WIDTH + (i * dayWidth)}
                            y2={chartHeight}
                            stroke="#E5E7EB"
                            strokeWidth={0.5}
                        />
                    );
                })}
                {rows.map((row, i) => {
                    const y = HEADER_HEIGHT + (i * ROW_HEIGHT);
                    const { start, end } = parsedDates[i];
                    const startDay = Math.ceil((start.getTime() - minDate.getTime()) / MS_PER_DAY);
                    const duration = Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
                    const barX = LABEL_WIDTH + (startDay * dayWidth);
                    const barW = Math.max(duration * dayWidth, 4);
                    const barColor = ganttBarColors[i % ganttBarColors.length];
                    const bgColor = i % 2 === 0 ? '#FAFAFA' : '#FFFFFF';
                    const halfRow = ROW_HEIGHT / 2;
                    const textY = y + halfRow + 4;
                    const maxChars = row.isSubtask ? 20 : 22;
                    const labelText = row.label.length > maxChars ? `${row.label.slice(0, maxChars)}\u2026` : row.label;

                    return (
                        <g key={row.id}>
                            <rect
                                x={0}
                                y={y}
                                width={LABEL_WIDTH}
                                height={ROW_HEIGHT}
                                fill={bgColor}
                            />
                            {row.isSubtask && (
                                <rect
                                    x={4}
                                    y={y}
                                    width={3}
                                    height={ROW_HEIGHT}
                                    fill="#D1D5DB"
                                />
                            )}
                            <text
                                x={row.isSubtask ? 14 : 8}
                                y={textY}
                                fontSize={row.isSubtask ? 10 : 11}
                                fill={row.completed ? '#9CA3AF' : '#1F2937'}
                            >
                                {row.isSubtask ? `\u21B3 ${labelText}` : labelText}
                            </text>
                            <rect
                                x={LABEL_WIDTH}
                                y={y}
                                width={chartWidth - LABEL_WIDTH}
                                height={ROW_HEIGHT}
                                fill={bgColor}
                            />
                            <rect
                                x={barX}
                                y={y + 6}
                                width={barW}
                                height={ROW_HEIGHT - 12}
                                rx={3}
                                fill={barColor}
                                opacity={row.completed ? 0.4 : 0.85}
                            />
                            {barW > 40 && row.assignee
                                && (
                                    <text
                                        x={barX + 4}
                                        y={textY}
                                        fontSize={9}
                                        fill="white"
                                    >{row.assignee}
                                    </text>
                                )}
                        </g>
                    );
                })}

                {rows.map((row, toIdx) =>
                    row.dependsOn.map(depId => {
                        const fromIdx = rowIndexMap.get(depId);
                        if (fromIdx === undefined) {
                            return null;
                        }
                        const { end: fromEnd } = parsedDates[fromIdx];
                        const { start: toStart } = parsedDates[toIdx];
                        const fromEndDay = Math.ceil((fromEnd.getTime() - minDate.getTime()) / MS_PER_DAY) + 1;
                        const toStartDay = Math.ceil((toStart.getTime() - minDate.getTime()) / MS_PER_DAY);
                        const x1 = LABEL_WIDTH + (fromEndDay * dayWidth);
                        const x2 = LABEL_WIDTH + (toStartDay * dayWidth);
                        const y1 = HEADER_HEIGHT + (fromIdx * ROW_HEIGHT) + (ROW_HEIGHT / 2);
                        const y2 = HEADER_HEIGHT + (toIdx * ROW_HEIGHT) + (ROW_HEIGHT / 2);
                        const midX = x1 + Math.max(8, (x2 - x1) / 2);
                        return (
                            <polyline
                                key={`dep-${depId}-${row.id}`}
                                points={`${x1},${y1} ${midX},${y1} ${midX},${y2} ${x2},${y2}`}
                                fill="none"
                                stroke="#6B7280"
                                strokeWidth={1.5}
                                markerEnd="url(#dep-arrow)"
                            />
                        );
                    }))}
            </svg>
        </div>
    );
}
