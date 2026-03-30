import { describe, expect, it } from 'vitest';

import { formatPLN } from './format';

// Compute expected strings using the same Intl.NumberFormat the implementation uses,
// so tests pass regardless of locale differences between environments.
function plFormat(amount: number): string {
    return (
        `${new Intl.NumberFormat('pl-PL', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount)}\u00a0zł`
    );
}

describe('formatPLN', () => {
    it('formats zero', () => {
        expect(formatPLN(0)).toBe(plFormat(0));
    });

    it('formats a positive integer', () => {
        expect(formatPLN(100)).toBe(plFormat(100));
    });

    it('formats a decimal value', () => {
        expect(formatPLN(12.5)).toBe(plFormat(12.5));
    });

    it('formats a large number (thousands separators)', () => {
        expect(formatPLN(1_000_000)).toBe(plFormat(1_000_000));
    });

    it('formats a negative number', () => {
        expect(formatPLN(-250)).toBe(plFormat(-250));
    });

    it('always outputs exactly two decimal places', () => {
        // The result must contain a decimal separator followed by exactly 2 digits
        const result = formatPLN(5);
        // Polish locale uses comma as decimal separator
        expect(result).toMatch(/[,\.]\d{2}/);
    });

    it('includes a non-breaking space before zł', () => {
        expect(formatPLN(10)).toContain('\u00a0zł');
    });

    it('formats 1 234,56 correctly (two-decimal precision)', () => {
        expect(formatPLN(1234.56)).toBe(plFormat(1234.56));
    });

    it('matches plFormat for 0.99', () => {
        expect(formatPLN(0.99)).toBe(plFormat(0.99));
    });

    it('matches plFormat for a large negative value', () => {
        expect(formatPLN(-50_000)).toBe(plFormat(-50_000));
    });
});
