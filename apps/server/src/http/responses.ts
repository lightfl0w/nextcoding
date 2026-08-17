import type { Context } from "hono";

export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 500;

export type JsonBody = Record<string, unknown>;

export function jsonError(c: Context, message: string, status: ErrorStatus) {
    return c.json({ error: message }, status);
}

export async function readJsonBody(c: Context): Promise<JsonBody> {
    try {
        const parsed: unknown = await c.req.json();
        return isJsonObject(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

export function readString(body: JsonBody, key: string): string {
    const value = body[key];
    return typeof value === "string" ? value : "";
}

export function readTrimmed(body: JsonBody, key: string): string {
    return readString(body, key).trim();
}

export function readFlag(body: JsonBody, key: string): boolean {
    return body[key] === true;
}

function isJsonObject(value: unknown): value is JsonBody {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
