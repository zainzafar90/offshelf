export function sniffImage(bytes: Uint8Array): string | undefined {
    const head = new TextDecoder('ascii').decode(bytes.slice(0, 32));

    if (bytes[0] === 0x89 && head.slice(1, 4) === 'PNG')
        return 'image/png';

    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
        return 'image/jpeg';

    if (head.startsWith('GIF87a') || head.startsWith('GIF89a'))
        return 'image/gif';

    if (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP')
        return 'image/webp';

    if (head.slice(4, 8) === 'ftyp' && /avif|avis/.test(head.slice(8)))
        return 'image/avif';

    if (head.startsWith('BM'))
        return 'image/bmp';

    return undefined;
}
