import { afterEach, describe, expect, it, vi } from 'vitest';

import { compressToGzip, decompressFromGzip, isCompressionSupported } from './compression';


// Determine at module-load time whether both APIs AND Blob.stream() are present,
// so we can skip roundtrip tests in environments that lack them.
const blobStreamSupported = isCompressionSupported && typeof new Blob().stream === 'function';

describe('isCompressionSupported', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('is a boolean', () => {
        expect(typeof isCompressionSupported).toBe('boolean');
    });

    it('mirrors the availability of CompressionStream and DecompressionStream', () => {
        const expected
            = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
        expect(isCompressionSupported).toBe(expected);
    });

    it('the expression evaluates to false when both globals are absent', () => {
        vi.stubGlobal('CompressionStream', undefined);
        vi.stubGlobal('DecompressionStream', undefined);
        const expr
            = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
        expect(expr).toBe(false);
    });

    it('the expression evaluates to false when only DecompressionStream is absent', () => {
        vi.stubGlobal('DecompressionStream', undefined);
        const expr
            = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
        expect(expr).toBe(false);
    });
});

describe('compressToGzip / decompressFromGzip roundtrip', () => {
    it.skipIf(!blobStreamSupported)('roundtrips an ASCII string', async () => {
        const original = 'Hello, World!';
        const compressed = await compressToGzip(original);
        const result = await decompressFromGzip(compressed);
        expect(result).toBe(original);
    });

    it.skipIf(!blobStreamSupported)('roundtrips an empty string', async () => {
        const original = '';
        const compressed = await compressToGzip(original);
        const result = await decompressFromGzip(compressed);
        expect(result).toBe(original);
    });

    it.skipIf(!blobStreamSupported)('roundtrips JSON data', async () => {
        const original = JSON.stringify({
            notes: [{ id: 'n1', title: 'Test' }],
            tasks: [],
            expenses: [],
            calendarEvents: [],
            budget: 5000
        });
        const compressed = await compressToGzip(original);
        const result = await decompressFromGzip(compressed);
        expect(result).toBe(original);
    });

    it.skipIf(!blobStreamSupported)('roundtrips a unicode / emoji string', async () => {
        const original = 'Zł 100,00 złoty ąęśćńłóżź 🏠 renovation';
        const compressed = await compressToGzip(original);
        const result = await decompressFromGzip(compressed);
        expect(result).toBe(original);
    });

    it.skipIf(!blobStreamSupported)(
        'compressed blob is smaller than a large repetitive plaintext input',
        async () => {
            const original = 'abcdefghijklmnopqrstuvwxyz'.repeat(500);
            const compressed = await compressToGzip(original);
            expect(compressed.size).toBeLessThan(original.length);
        }
    );

    it.skipIf(!blobStreamSupported)('compressToGzip returns a Blob', async () => {
        const compressed = await compressToGzip('test');
        expect(compressed).toBeInstanceOf(Blob);
    });
});
