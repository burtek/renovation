/** Format a number as Polish złoty: `1 000,00 zł` */
export function formatPLN(amount: number): string {
    return (
        `${new Intl.NumberFormat('pl-PL', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount)}\u00a0zł`
    );
}

/** Format a fraction (0–1) as a percentage string: `42.3%` */
export function formatPct(fraction: number): string {
    return `${(fraction * 100).toFixed(1)}%`;
}
