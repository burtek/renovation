import { describe, expect, it } from 'vitest';

import { cn } from './classnames';


describe('cn', () => {
    it('joins two truthy strings', () => {
        expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('returns a single string unchanged', () => {
        expect(cn('only')).toBe('only');
    });

    it('returns empty string when called with no arguments', () => {
        expect(cn()).toBe('');
    });

    it('filters out false values', () => {
        expect(cn('a', false, 'b')).toBe('a b');
    });

    it('filters out null values', () => {
        expect(cn('a', null, 'b')).toBe('a b');
    });

    it('filters out undefined values', () => {
        expect(cn('a', undefined, 'b')).toBe('a b');
    });

    it('filters out empty strings', () => {
        expect(cn('a', '', 'b')).toBe('a b');
    });

    it('returns empty string when all values are falsy', () => {
        expect(cn(false, null, undefined)).toBe('');
    });

    it('handles conditional class pattern', () => {
        const isActive: boolean = String('active').length > 0;
        expect(cn('base', isActive && 'active')).toBe('base active');
    });

    it('handles conditional class pattern when condition is false', () => {
        const isActive: boolean = String('').length > 0;
        expect(cn('base', isActive && 'active')).toBe('base');
    });

    it('preserves whitespace within individual class strings', () => {
        // Inputs with internal spaces are passed through as-is
        expect(cn('px-3 py-2', 'text-sm')).toBe('px-3 py-2 text-sm');
    });
});
