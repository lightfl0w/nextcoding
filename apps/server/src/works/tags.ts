export function parseTags(raw: string | null): string[] {
    if (!raw) {
        return [];
    }
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.filter((tag): tag is string => typeof tag === "string");
    } catch {
        return [];
    }
}
