const table = new Uint32Array(256);

for (let n = 0; n < 256; n++) {
    let c = n;

    for (let k = 0; k < 8; k++)
        c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;

    table[n] = c >>> 0;
}

export type ZipEntry = { name: string; bytes: Uint8Array<ArrayBuffer> };

export function crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;

    for (const byte of bytes)
        crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);

    return (crc ^ 0xffffffff) >>> 0;
}

export function createZip(entries: ZipEntry[]): Blob {
    if (entries.length > 65_535)
        throw new Error('Too many files for this ZIP archive.');

    const locals: BlobPart[] = [];
    const central: BlobPart[] = [];
    let offset = 0;
    let centralSize = 0;

    for (const entry of entries) {
        if (entry.name.startsWith('/') || entry.name.split('/').includes('..'))
            throw new Error('Unsafe archive filename.');

        const name = new TextEncoder().encode(entry.name);
        const size = entry.bytes.byteLength;
        const crc = crc32(entry.bytes);

        if (size > 0xffffffff || offset + size > 0xffffffff)
            throw new Error('The archive exceeds the ZIP32 size limit.');

        const local = new ArrayBuffer(30);
        const l = new DataView(local);

        l.setUint32(0, 0x04034b50, true);
        l.setUint16(4, 20, true);
        l.setUint16(6, 0x800, true);
        l.setUint16(12, 0x21, true);
        l.setUint32(14, crc, true);
        l.setUint32(18, size, true);
        l.setUint32(22, size, true);
        l.setUint16(26, name.length, true);
        locals.push(local, name, entry.bytes);
        const header = new ArrayBuffer(46);
        const h = new DataView(header);

        h.setUint32(0, 0x02014b50, true);
        h.setUint16(4, 20, true);
        h.setUint16(6, 20, true);
        h.setUint16(8, 0x800, true);
        h.setUint16(14, 0x21, true);
        h.setUint32(16, crc, true);
        h.setUint32(20, size, true);
        h.setUint32(24, size, true);
        h.setUint16(28, name.length, true);
        h.setUint32(42, offset, true);
        central.push(header, name);
        centralSize += 46 + name.length;
        offset += 30 + name.length + size;
    }

    const end = new ArrayBuffer(22);
    const e = new DataView(end);

    e.setUint32(0, 0x06054b50, true);
    e.setUint16(8, entries.length, true);
    e.setUint16(10, entries.length, true);
    e.setUint32(12, centralSize, true);
    e.setUint32(16, offset, true);

    return new Blob([...locals, ...central, end], { type: 'application/zip' });
}
