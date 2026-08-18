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
import { findVersion } from "./repository.js";

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
    tree?: string;
    hash?: string;
    parent?: string | null;
}

/**
 * 计算文件树的稳定内容哈希（树对象地址）。
 *
 * 对清单按文件名排序后拼接 `name\tcontentType\tsize\thash` 行再取 SHA-256。
 * 相同内容的树必然得到相同哈希，可用于增量同步与版本引用。
 *
 * @param files - 快照文件条目。
 */
export function computeTreeHash(files: SnapshotFile[]): string {
    const lines = files
        .map(
            (file) =>
                `${file.name}\t${file.contentType ?? ""}\t${file.size ?? 0}\t${file.hash ?? ""}`,
        )
        .sort()
        .join("\n");
    return sha256Hex(fromText(lines));
}

/**
 * 计算提交的内容寻址哈希。
 *
 * 哈希覆盖树哈希、父提交哈希、消息与创建时间，因此提交哈希同时承诺
 * 整棵文件树与完整历史（篡改任一祖先会改变全部后代哈希，与 git 一致）。
 *
 * @param input.tree - 本次提交的树哈希。
 * @param input.parent - 父提交哈希；无则 null。
 * @param input.message - 提交消息。
 * @param input.createdAt - 提交时间（毫秒）。
 */
export function computeCommitHash(input: {
    tree: string;
    parent: string | null;
    message: string | null;
    createdAt: number;
}): string {
    const canonical = JSON.stringify({
        tree: input.tree,
        parent: input.parent,
        message: input.message ?? "",
        createdAt: input.createdAt,
    });
    return sha256Hex(fromText(canonical));
}

export interface CommitRef {
    version: number;
    message: string | null;
    createdAt: number;
    tree: string;
    hash: string;
    parent: string | null;
}

/**
 * 构建提交哈希链（按版本升序）。
 *
 * 从快照解析树哈希并逐版本计算提交哈希；已有 `hash/parent` 字段的快照
 * 直接沿用，旧格式快照按 `parent = 前一提交哈希` 补齐，因此新旧数据可以混链。
 *
 * @param workId - 作品 ID。
 * @param summaries - 版本摘要，新版本在前（listVersionSummaries 的返回顺序）。
 * @returns 按版本升序的提交引用。
 */
export async function buildCommitChain(
    workId: string,
    summaries: Array<{
        version: number;
        message: string | null;
        createdAt: Date;
        hash?: string | null;
        tree?: string | null;
        parent?: string | null;
    }>,
): Promise<CommitRef[]> {
    const storage = getStorage();
    const refs: CommitRef[] = [];
    let previous: string | null = null;

    for (const summary of [...summaries].reverse()) {
        if (summary.hash && summary.tree) {
            const parent = summary.parent ?? previous;
            refs.push({
                version: summary.version,
                message: summary.message,
                createdAt: summary.createdAt.getTime(),
                tree: summary.tree,
                hash: summary.hash,
                parent,
            });
            previous = summary.hash;
            continue;
        }

        const row = await findVersion(workId, summary.version);
        if (!row) {
            continue;
        }
        const raw = await storage.get(row.snapshotKey);
        if (!raw) {
            continue;
        }
        const snapshot = parseSnapshot(raw);
        const tree = computeTreeHash(snapshotFilesOf(snapshot));
        const parent = snapshot.parent ?? previous;
        const hash = computeCommitHash({
            tree,
            parent,
            message: snapshot.message ?? summary.message,
            createdAt: snapshot.createdAt ?? summary.createdAt.getTime(),
        });
        refs.push({
            version: summary.version,
            message: summary.message,
            createdAt: summary.createdAt.getTime(),
            tree,
            hash,
            parent,
        });
        previous = hash;
    }
    return refs;
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
