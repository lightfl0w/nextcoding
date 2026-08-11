const FORBIDDEN_SEGMENTS = new Set(["", ".", ".."]);

export function isValidFileName(name: string): boolean {
    if (!name || name.startsWith("/") || name.endsWith("/")) {
        return false;
    }
    return name.split("/").every((segment) => !FORBIDDEN_SEGMENTS.has(segment));
}

export function fileStorageKey(workId: string, name: string): string {
    return `works/${workId}/${name}`;
}

export function snapshotStorageKey(workId: string, version: number): string {
    return `works/${workId}/snapshots/v${version}.json`;
}

export function fileNameFromKey(key: string): string {
    return key.split("/").pop() || key;
}

export function parseVersionNumber(raw: string): number | null {
    const version = Number(raw);
    return Number.isInteger(version) && version >= 1 ? version : null;
}
