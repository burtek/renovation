type ClassValue = string | false | null | undefined;

/** Joins truthy class values into a single space-separated className string. */
export function cn(...classes: ClassValue[]): string {
    return classes.filter(Boolean).join(' ');
}
