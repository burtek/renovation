export function normalize(str: string | undefined, defaultValue: string): string;
export function normalize(str: string | undefined, defaultValue?: string): string | undefined;
export function normalize(str: string | undefined, defaultValue?: string): string | undefined {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    return str?.trim() || defaultValue;
}
