const BINARY_CONTENT_TYPES = new Set([
    "application/octet-stream",
    "application/pdf",
    "application/zip",
    "application/gzip",
    "application/x-zip-compressed",
]);

const BINARY_CONTENT_TYPE_PREFIXES = ["image/", "video/", "audio/"];

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

const decoder = new TextDecoder();
const encoder = new TextEncoder();

export type DecodeResult =
    | { ok: true; bytes: Uint8Array }
    | { ok: false; reason: string };

function isBinaryContentType(contentType: string | null | undefined): boolean {
    if (!contentType) return false;
    const normalized = contentType.toLowerCase();
    return (
        BINARY_CONTENT_TYPES.has(normalized) ||
        BINARY_CONTENT_TYPE_PREFIXES.some((prefix) =>
            normalized.startsWith(prefix),
        )
    );
}

export function isBinaryPayload(
    contentType: string | null,
    data: Uint8Array,
): boolean {
    if (isBinaryContentType(contentType)) return true;
    return !contentType && !isDecodableAsUtf8(data);
}

export function decodePayload(
    content: string,
    isBase64: boolean,
): DecodeResult {
    if (!isBase64) return { ok: true, bytes: encoder.encode(content) };

    const normalized = content.trim();
    if (!isWellFormedBase64(normalized)) {
        return { ok: false, reason: "base64 内容不合法" };
    }
    return {
        ok: true,
        bytes: new Uint8Array(Buffer.from(normalized, "base64")),
    };
}

export function toBase64(data: Uint8Array): string {
    return Buffer.from(data).toString("base64");
}

export function toText(data: Uint8Array): string {
    return decoder.decode(data);
}

export function fromText(text: string): Uint8Array {
    return encoder.encode(text);
}

export function fromBase64(text: string): Uint8Array {
    return new Uint8Array(Buffer.from(text, "base64"));
}

function isWellFormedBase64(value: string): boolean {
    return (
        value.length > 0 && value.length % 4 === 0 && BASE64_PATTERN.test(value)
    );
}

function isDecodableAsUtf8(data: Uint8Array): boolean {
    try {
        new TextDecoder("utf-8", { fatal: true }).decode(data);
        return true;
    } catch {
        return false;
    }
}
