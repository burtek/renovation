export const isCompressionSupported = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

export async function compressToGzip(text: string): Promise<Blob> {
    const compressedStream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    return await new Response(compressedStream, { headers: { 'Content-Type': 'application/gzip' } }).blob();
}

export async function decompressFromGzip(blob: Blob): Promise<string> {
    const decompressedStream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(decompressedStream).text();
}
