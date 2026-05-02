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

function pctFormat(fraction: number): string {
    return new Intl.NumberFormat('pl-PL', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    }).format(fraction);
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
    it.each([0, 0.5, 1, 1 / 3])(
        'delegates to pl-PL Intl.NumberFormat percent style for %d',
        fraction => {
            expect(formatPct(fraction)).toBe(pctFormat(fraction));
        }
    );

    it('always includes the % sign', () => {
        expect(formatPct(0.42)).toContain('%');
    });
});
