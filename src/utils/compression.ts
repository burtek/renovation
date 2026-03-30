export const isCompressionSupported = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

export async function compressToGzip(text: string): Promise<Blob> {
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    await writer.write(new TextEncoder().encode(text));
    await writer.close();
    return await new Response(stream.readable).blob();
}

export async function decompressFromGzip(blob: Blob): Promise<string> {
    const decompressedStream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(decompressedStream).text();
}
