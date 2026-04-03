import { act, renderHook } from '@testing-library/react';

import { useNow } from './useNow';


describe('useNow', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns the current timestamp on initial render', () => {
        const fixed = new Date('2024-06-01T12:00:00.000Z').getTime();
        vi.setSystemTime(fixed);

        const { result } = renderHook(() => useNow());

        expect(result.current).toBe(fixed);
    });

    it('updates after 60 seconds via interval', () => {
        const t0 = new Date('2024-06-01T12:00:00.000Z').getTime();
        vi.setSystemTime(t0);

        const { result } = renderHook(() => useNow());
        expect(result.current).toBe(t0);

        // advanceTimersByTime also moves the clock forward, so after 60s the clock is at t0 + 60_000
        act(() => {
            vi.advanceTimersByTime(60_000);
        });

        expect(result.current).toBe(t0 + 60_000);
    });

    it('does not update before 60 seconds have passed', () => {
        const t0 = new Date('2024-06-01T12:00:00.000Z').getTime();
        vi.setSystemTime(t0);

        const { result } = renderHook(() => useNow());

        act(() => {
            vi.setSystemTime(t0 + 59_999);
            vi.advanceTimersByTime(59_999);
        });

        expect(result.current).toBe(t0);
    });

    it('updates on visibilitychange event when document is visible', () => {
        const t0 = new Date('2024-06-01T12:00:00.000Z').getTime();
        vi.setSystemTime(t0);

        const { result } = renderHook(() => useNow());
        expect(result.current).toBe(t0);

        const t1 = t0 + 30_000;
        act(() => {
            vi.setSystemTime(t1);
            document.dispatchEvent(new Event('visibilitychange'));
        });

        expect(result.current).toBe(t1);
    });

    it('does not update on visibilitychange when document is hidden', () => {
        const t0 = new Date('2024-06-01T12:00:00.000Z').getTime();
        vi.setSystemTime(t0);

        const { result } = renderHook(() => useNow());
        expect(result.current).toBe(t0);

        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
        act(() => {
            vi.setSystemTime(t0 + 30_000);
            document.dispatchEvent(new Event('visibilitychange'));
        });
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

        expect(result.current).toBe(t0);
    });

    it('clears the interval on unmount', () => {
        const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
        const { unmount } = renderHook(() => useNow());

        unmount();

        expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('removes the visibilitychange listener on unmount', () => {
        const removeListenerSpy = vi.spyOn(document, 'removeEventListener');
        const { unmount } = renderHook(() => useNow());

        unmount();

        expect(removeListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });
});
