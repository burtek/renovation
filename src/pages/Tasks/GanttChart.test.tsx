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
});
