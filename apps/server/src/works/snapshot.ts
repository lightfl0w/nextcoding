import { createHash } from "node:crypto";
import type { StorageAdapter } from "@nextcoding/storage";
import { getStorage } from "../storage/storageClient.js";
import {
    fromBase64,
    fromText,
    isBinaryPayload,
    toBase64,
    toText,
} from "./content.js";
import { blobStorageKey } from "./naming.js";
import type { WorkFileRow } from "./repository.js";

export interface SnapshotFile {
    key: string;
    name: string;
    contentType: string | null;
    content?: string;
    encoding?: "base64";
    hash?: string;
    size?: number;
}

export interface Snapshot {
    version: number;
    message: string | null;
    createdAt: number;
    files: SnapshotFile[];
}

/**
 * 采集当前文件列表为快照条目。
 * @param files - 作品文件行。
 * @returns 按内容哈希引用 blob 的条目（相同内容自动去重）。
 * @remarks 每个文件内容写入 `works/{workId}/blobs/{hash}`，快照只存哈希引用。
 */
export function captureFiles(files: WorkFileRow[]): Promise<SnapshotFile[]> {
    const storage = getStorage();
    return Promise.all(
        files.map(async (file) => {
            const data = await storage.get(file.key);
            return toSnapshotFile(storage, file, data);
        }),
    );
}

export function serializeSnapshot(snapshot: Snapshot): Uint8Array {
    return fromText(JSON.stringify(snapshot));
}

export function parseSnapshot(raw: Uint8Array): Snapshot {
    return JSON.parse(toText(raw)) as Snapshot;
}

export function snapshotFilesOf(snapshot: Snapshot): SnapshotFile[] {
    return Array.isArray(snapshot.files) ? snapshot.files : [];
}

/**
 * 解码旧格式内联条目为字节。
 * @param file - 内联内容条目（`content`/`encoding`）。
 * @returns 原始字节。
 */
export function decodeSnapshotFile(file: SnapshotFile): Uint8Array {
    const content = typeof file.content === "string" ? file.content : "";
    return file.encoding === "base64" ? fromBase64(content) : fromText(content);
}

/**
 * 解析快照条目的可展示内容。
 * @param workId - 作品 ID（旧格式条目不使用）。
 * @param file - 快照条目，哈希引用或内联内容均可。
 * @returns 文本内容；二进制条目标记 base64。
 */
export async function resolveSnapshotFileContent(
    workId: string,
    file: SnapshotFile,
): Promise<{ content: string; encoding?: "base64" }> {
    if (file.hash) {
        const raw = await getStorage().get(blobStorageKey(workId, file.hash));
        if (raw === null) {
            return { content: "" };
        }
        return isBinaryPayload(file.contentType, raw)
            ? { content: toBase64(raw), encoding: "base64" }
            : { content: toText(raw) };
    }
    return { content: file.content ?? "", encoding: file.encoding };
}

/**
 * 解析快照条目的原始字节（回滚用）。
 * @param workId - 作品 ID。
 * @param file - 快照条目，哈希引用或内联内容均可。
 * @returns 原始字节；哈希 blob 缺失时按空内容兜底。
 */
export async function resolveSnapshotFileBytes(
    workId: string,
    file: SnapshotFile,
): Promise<Uint8Array> {
    if (file.hash) {
        const raw = await getStorage().get(blobStorageKey(workId, file.hash));
        return raw ?? new Uint8Array(0);
    }
    return decodeSnapshotFile(file);
}

async function toSnapshotFile(
    storage: StorageAdapter,
    file: WorkFileRow,
    data: Uint8Array | null,
): Promise<SnapshotFile> {
    const bytes = data ?? new Uint8Array(0);
    const hash = sha256Hex(bytes);
    await storage.put(blobStorageKey(file.workId, hash), bytes);
    return {
        key: file.key,
        name: file.name,
        contentType: file.contentType,
        size: bytes.byteLength,
        hash,
    };
}

function sha256Hex(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex");
}
