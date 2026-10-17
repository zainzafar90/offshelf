export function fileName(value: string): string {
    return value.normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1F]/g, '').replace(/[. ]+$/g, '').trim().slice(0, 90) || 'saved-document';
}
