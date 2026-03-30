export async function compressToGzip(text: string): Promise<Blob> {
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    await writer.write(new TextEncoder().encode(text));
    await writer.close();
    return await new Response(stream.readable).blob();
}

export async function decompressFromGzip(blob: Blob): Promise<string> {
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    await writer.write(await blob.arrayBuffer());
    await writer.close();
    const buffer = await new Response(stream.readable).arrayBuffer();
    return new TextDecoder().decode(buffer);
}
