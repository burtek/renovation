import { act, render, screen } from '@testing-library/react';

import type { Task } from '../../types';

import GanttChart from './GanttChart';


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<Task> = {}): Task {
    return {
        id: 't1',
        title: 'Task',
        notes: '',
        completed: false,
        subtasks: [],
        dependsOn: [],
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GanttChart', () => {
    beforeEach(() => {
        vi.stubGlobal('ResizeObserver', class {
            observe() {
            }

            unobserve() {
            }

            disconnect() {
            }
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('shows the empty state message when no tasks have dates', () => {
        render(<GanttChart tasks={[makeTask()]} />);
        expect(screen.getByText(/no tasks or subtasks with start and end dates/i)).toBeInTheDocument();
    });

    it('renders an SVG when at least one task has startDate and endDate', () => {
        render(
            <GanttChart tasks={[makeTask({ startDate: '2024-01-01', endDate: '2024-01-10' })]} />
        );
        expect(document.querySelector('svg')).toBeInTheDocument();
    });

    it('renders a row label for each task with dates', () => {
        render(
            <GanttChart tasks={[
                makeTask({ id: 't1', title: 'Alpha', startDate: '2024-01-01', endDate: '2024-01-05' }),
                makeTask({ id: 't2', title: 'Beta', startDate: '2024-01-06', endDate: '2024-01-10' })
            ]}
            />
        );
        const svgTexts = Array.from(document.querySelectorAll('svg text')).map(t => t.textContent ?? '');
        expect(svgTexts.some(l => l.includes('Alpha'))).toBe(true);
        expect(svgTexts.some(l => l.includes('Beta'))).toBe(true);
    });

    it('renders a subtask row with the arrow prefix for subtasks with dates', () => {
        render(
            <GanttChart tasks={[
                makeTask({
                    id: 't1',
                    title: 'Parent',
                    startDate: '2024-01-01',
                    endDate: '2024-01-10',
                    subtasks: [
                        {
                            id: 's1',
                            parentId: 't1',
                            title: 'Child',
                            notes: '',
                            completed: false,
                            startDate: '2024-01-02',
                            endDate: '2024-01-05'
                        }
                    ]
                })
            ]}
            />
        );
        const svgTexts = Array.from(document.querySelectorAll('svg text')).map(t => t.textContent ?? '');
        expect(svgTexts.some(l => l.includes('Child'))).toBe(true);
    });

    it('renders a polyline for tasks with dependsOn', () => {
        render(
            <GanttChart tasks={[
                makeTask({ id: 'a', title: 'A', startDate: '2024-01-01', endDate: '2024-01-05', dependsOn: [] }),
                makeTask({ id: 'b', title: 'B', startDate: '2024-01-06', endDate: '2024-01-10', dependsOn: ['a'] })
            ]}
            />
        );
        expect(document.querySelector('polyline')).toBeInTheDocument();
    });

    it('does not render a polyline when the dependency has no Gantt row (no dates)', () => {
        render(
            <GanttChart tasks={[
                makeTask({ id: 'a', title: 'A' }),
                makeTask({ id: 'b', title: 'B', startDate: '2024-01-06', endDate: '2024-01-10', dependsOn: ['a'] })
            ]}
            />
        );
        expect(document.querySelector('polyline')).not.toBeInTheDocument();
    });

    it('does not render a polyline when there are no dependencies', () => {
        render(
            <GanttChart tasks={[makeTask({ id: 't1', startDate: '2024-01-01', endDate: '2024-01-10', dependsOn: [] })]} />
        );
        expect(document.querySelector('polyline')).not.toBeInTheDocument();
    });

    it('responds to ResizeObserver callback and updates chart width', async () => {
        type ResizeFn = (entries: Array<{ contentRect: { width: number } }>) => void;
        let capturedFn: ResizeFn | null = null;
        let observedElement: Element | null = null;
        vi.stubGlobal('ResizeObserver', class {
            constructor(fn: ResizeFn) {
                capturedFn = fn;
            }

            observe(el: Element) {
                observedElement = el;
            }

            unobserve() {
            }

            disconnect() {
            }
        });

        render(
            <GanttChart tasks={[makeTask({ startDate: '2024-01-01', endDate: '2024-01-31' })]} />
        );

        expect(observedElement).not.toBeNull();

        // Simulate a resize with a known width
        const newWidth = 800;
        await act(async () => {
            capturedFn?.([{ contentRect: { width: newWidth } }]);
        });

        // SVG should now have a width that reflects the updated container size
        const svg = document.querySelector('svg');
        expect(svg).toBeInTheDocument();
        const svgWidth = Number(svg?.getAttribute('width'));
        expect(svgWidth).toBeGreaterThanOrEqual(newWidth);
    });

    it('falls back gracefully when ResizeObserver is undefined', () => {
        vi.stubGlobal('ResizeObserver', undefined);
        expect(() => {
            render(
                <GanttChart tasks={[makeTask({ startDate: '2024-01-01', endDate: '2024-01-10' })]} />
            );
        }).not.toThrow();
        expect(document.querySelector('svg')).toBeInTheDocument();
    });

    it('uses clientWidth from the scroll container for initial width measurement', () => {
        const mockClientWidth = 2000;
        vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(mockClientWidth);

        // 3-day task + MARGIN_DAYS(3)*2 = 9 total days
        // availableForDays = 2000 - 220 (LABEL_WIDTH) = 1780
        // dayWidth = max(20, 1780 / 9) ≈ 197.8 → chartWidth = 220 + 9 * 197.8 ≈ 2000
        render(
            <GanttChart tasks={[makeTask({ startDate: '2024-01-01', endDate: '2024-01-03' })]} />
        );

        const svg = document.querySelector('svg');
        expect(svg).toBeInTheDocument();
        const svgWidth = Number(svg?.getAttribute('width'));
        expect(svgWidth).toBeCloseTo(mockClientWidth, 0);
    });

    // ── Completed task visual state ───────────────────────────────────────

    it('renders completed task bar with reduced opacity and muted label colour', () => {
        render(
            <GanttChart tasks={[makeTask({ id: 't1', title: 'Done', startDate: '2024-01-01', endDate: '2024-01-05', completed: true })]} />
        );
        // Bar rect should carry reduced opacity for completed tasks
        const rects = Array.from(document.querySelectorAll('svg rect'));
        expect(rects.some(r => r.getAttribute('opacity') === '0.4')).toBe(true);
        // Row label text should use muted (#9CA3AF) fill instead of the normal dark fill
        const texts = Array.from(document.querySelectorAll('svg text'));
        expect(texts.some(t => t.getAttribute('fill') === '#9CA3AF')).toBe(true);
    });

    // ── Long label truncation ─────────────────────────────────────────────

    it('truncates task labels longer than 22 characters with an ellipsis', () => {
        const longTitle = 'Renovation floor preparation work'; // 33 chars, well above 22
        render(
            <GanttChart tasks={[makeTask({ title: longTitle, startDate: '2024-01-01', endDate: '2024-01-10' })]} />
        );
        const svgTexts = Array.from(document.querySelectorAll('svg text')).map(t => t.textContent ?? '');
        // The original untruncated title should NOT appear verbatim
        expect(svgTexts.every(t => t !== longTitle)).toBe(true);
        // An ellipsis should be present in one of the text nodes
        expect(svgTexts.some(t => t.includes('\u2026'))).toBe(true);
    });

    it('truncates subtask labels longer than 20 characters with an ellipsis', () => {
        const longSubtaskTitle = 'Very long subtask name here'; // 27 chars, above 20
        render(
            <GanttChart tasks={[
                makeTask({
                    id: 't1',
                    title: 'Parent',
                    startDate: '2024-01-01',
                    endDate: '2024-01-15',
                    subtasks: [
                        {
                            id: 's1',
                            parentId: 't1',
                            title: longSubtaskTitle,
                            notes: '',
                            completed: false,
                            dependsOn: [],
                            startDate: '2024-01-02',
                            endDate: '2024-01-10'
                        }
                    ]
                })
            ]}
            />
        );
        const svgTexts = Array.from(document.querySelectorAll('svg text')).map(t => t.textContent ?? '');
        expect(svgTexts.every(t => !t.includes(longSubtaskTitle))).toBe(true);
        expect(svgTexts.some(t => t.includes('\u2026'))).toBe(true);
    });

    // ── Assignee name inside bar ──────────────────────────────────────────

    it('shows assignee name inside the bar when the task duration makes the bar wide enough', () => {
        // dayWidth = MIN_DAY_WIDTH (20px) in jsdom (containerWidth = 0)
        // Jan 1–3 span: duration = Math.ceil(2) + 1 = 3 → barW = 3 × 20 = 60 > 40
        render(
            <GanttChart tasks={[makeTask({ id: 't1', title: 'Task', startDate: '2024-01-01', endDate: '2024-01-03', assignee: 'Alice' })]} />
        );
        const svgTexts = Array.from(document.querySelectorAll('svg text')).map(t => t.textContent ?? '');
        expect(svgTexts.some(t => t === 'Alice')).toBe(true);
    });

    // ── Backward-compatible rendering with old data (no dependsOn) ────────

    it('renders correctly when task and subtask have no dependsOn field (old data format)', () => {
        // Tasks/subtasks saved before dependsOn was introduced have the field absent.
        // GanttChart must still render without throwing.
        const oldTask = {
            id: 't1',
            title: 'Legacy Task',
            notes: '',
            completed: false,
            startDate: '2024-01-01',
            endDate: '2024-01-10',
            subtasks: [
                {
                    id: 's1',
                    parentId: 't1',
                    title: 'Legacy Sub',
                    notes: '',
                    completed: false,
                    startDate: '2024-01-02',
                    endDate: '2024-01-08'
                // no dependsOn — old format
                }
            ]
            // no dependsOn — old format
        } as unknown as import('../../types').Task;

        render(<GanttChart tasks={[oldTask]} />);

        expect(document.querySelector('svg')).toBeInTheDocument();
        const svgTexts = Array.from(document.querySelectorAll('svg text')).map(t => t.textContent ?? '');
        expect(svgTexts.some(t => t.includes('Legacy Task'))).toBe(true);
        expect(svgTexts.some(t => t.includes('Legacy Sub'))).toBe(true);
    });

    // ── Subtasks without dates are excluded from the Gantt ────────────────

    it('excludes subtasks without dates while still rendering dated siblings', () => {
        // This verifies that undated subtasks are silently skipped, not that they
        // cause an error or leave a blank row.
        render(
            <GanttChart tasks={[
                makeTask({
                    id: 't1',
                    title: 'Parent',
                    startDate: '2024-01-01',
                    endDate: '2024-01-15',
                    subtasks: [
                        {
                            id: 's1',
                            parentId: 't1',
                            title: 'Dated Sub',
                            notes: '',
                            completed: false,
                            dependsOn: [],
                            startDate: '2024-01-02',
                            endDate: '2024-01-10'
                        },
                        {
                            id: 's2',
                            parentId: 't1',
                            title: 'Undated Sub',
                            notes: '',
                            completed: false,
                            dependsOn: []
                            // no startDate / endDate — should be excluded
                        }
                    ]
                })
            ]}
            />
        );
        const svgTexts = Array.from(document.querySelectorAll('svg text')).map(t => t.textContent ?? '');
        expect(svgTexts.some(t => t.includes('Dated Sub'))).toBe(true);
        expect(svgTexts.every(t => !t.includes('Undated Sub'))).toBe(true);
    });
});
