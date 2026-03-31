import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useColorScheme } from './useColorScheme';


describe('useColorScheme', () => {
    let listeners: ((e: { matches: boolean }) => void)[];
    let matchesDark: boolean;

    beforeEach(() => {
        listeners = [];
        matchesDark = false;

        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: (query: string) => ({
                matches: query === '(prefers-color-scheme: dark)' ? matchesDark : false,
                media: query,
                onchange: null,
                addListener: () => {
                },
                removeListener: () => {
                },
                addEventListener: (_: string, handler: (e: { matches: boolean }) => void) => {
                    listeners.push(handler);
                },
                removeEventListener: (_: string, handler: (e: { matches: boolean }) => void) => {
                    listeners = listeners.filter(l => l !== handler);
                },
                dispatchEvent: () => false
            })
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns "light" when prefers-color-scheme does not match dark', () => {
        matchesDark = false;
        const { result } = renderHook(() => useColorScheme());
        expect(result.current).toBe('light');
    });

    it('returns "dark" when prefers-color-scheme matches dark', () => {
        matchesDark = true;
        const { result } = renderHook(() => useColorScheme());
        expect(result.current).toBe('dark');
    });

    it('updates to "dark" when media query change event fires with matches=true', () => {
        matchesDark = false;
        const { result } = renderHook(() => useColorScheme());
        expect(result.current).toBe('light');

        act(() => {
            listeners.forEach(l => l({ matches: true }));
        });

        expect(result.current).toBe('dark');
    });

    it('updates to "light" when media query change event fires with matches=false', () => {
        matchesDark = true;
        const { result } = renderHook(() => useColorScheme());
        expect(result.current).toBe('dark');

        act(() => {
            listeners.forEach(l => l({ matches: false }));
        });

        expect(result.current).toBe('light');
    });

    it('removes event listener on unmount', () => {
        matchesDark = false;
        const { result, unmount } = renderHook(() => useColorScheme());
        expect(listeners).toHaveLength(1);

        unmount();

        expect(listeners).toHaveLength(0);
        expect(result.current).toBe('light');
    });
});
