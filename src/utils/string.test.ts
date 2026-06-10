import { describe, expect, it } from 'vitest';

import { normalize } from './string';


describe('normalize', () => {
    it('trims non-empty values', () => {
        expect(normalize('  abc  ')).toBe('abc');
    });

    it('returns fallback for undefined and blank values', () => {
        expect(normalize(undefined, 'fallback')).toBe('fallback');
        expect(normalize('   ', 'fallback')).toBe('fallback');
    });

    it('returns undefined when no fallback is provided', () => {
        expect(normalize(undefined)).toBeUndefined();
        expect(normalize('   ')).toBeUndefined();
    });
});
