import { formatPct, formatPLN } from './format';


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
    it.each([0, 100, 12.5, -250, 1_000_000])(
        'delegates to pl-PL Intl.NumberFormat for %d',
        amount => {
            expect(formatPLN(amount)).toBe(plFormat(amount));
        }
    );

    it('always outputs exactly two decimal places', () => {
        expect(formatPLN(5)).toMatch(/[,.]\d{2}/);
    });

    it('includes a non-breaking space before zł', () => {
        expect(formatPLN(10)).toContain('\u00a0zł');
    });
});

describe('formatPct', () => {
    it('formats 0 as 0.0%', () => {
        expect(formatPct(0)).toBe('0.0%');
    });

    it('formats 1 as 100.0%', () => {
        expect(formatPct(1)).toBe('100.0%');
    });

    it('formats 0.5 as 50.0%', () => {
        expect(formatPct(0.5)).toBe('50.0%');
    });

    it('rounds to one decimal place', () => {
        expect(formatPct(1 / 3)).toBe('33.3%');
    });

    it('always includes the % sign', () => {
        expect(formatPct(0.42)).toContain('%');
    });
});
