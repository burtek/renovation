export function normalize(str: string | undefined, defaultValue: string): string;
export function normalize(str: string | undefined, defaultValue?: string): string | undefined;
export function normalize(str: string | undefined, defaultValue?: string): string | undefined {
    // Empty strings (after trim) and undefined values are treated as missing.
    // `||` is intentional here so blank values fall back to defaultValue (unlike `??`).
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    return str?.trim() || defaultValue;
}
