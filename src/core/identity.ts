// FNV-1a 64-bit identifies URLs; document IDs also keep the source URL for collision checks.
export function stableId(value: string): string {
    let hash = 0xcbf29ce484222325n;

    for (const byte of new TextEncoder().encode(value)) {
        hash ^= BigInt(byte);
        hash = BigInt.asUintN(64, hash * 0x100000001b3n);
    }

    return hash.toString(16).padStart(16, '0');
}
