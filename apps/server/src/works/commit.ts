import { createHash } from "node:crypto";
import type { StorageAdapter } from "@nextcoding/storage";
import type { JsonBody } from "../http/responses.js";
import { getStorage } from "../storage/storageClient.js";
import { decodePayload, fromText } from "./content.js";
import {
    exceedsFileSizeLimit,
    fileSizeLimitMessage,
    VERSIONS_PAGE_SIZE,
} from "./limits.js";
import {
    blobStorageKey,
    commitStorageKey,
    fileStorageKey,
    isBlobHash,
    isValidFileName,
    snapshotStorageKey,
} from "./naming.js";
import { mapLimit } from "./pool.js";
import {
    bumpWorkFileVersion,
    deleteWorkFile,
    insertVersion,
    insertWorkFiles,
    listVersionSummaries,
    listWorkFiles,
    nextVersionNumber,
    touchWork,
    type WorkFileRow,
} from "./repository.js";
import {
    buildCommitChain,
    computeCommitHash,
    computeTreeHash,
    type Snapshot,
    type SnapshotFile,
    serializeSnapshot,
} from "./snapshot.js";

export interface CommitFile {
    name: string;
    bytes: Uint8Array;
    contentType: string | null;
}

const IO_CONCURRENCY = 32;

export type CommitParseResult =
    | { ok: true; files: CommitFile[] }
    | { ok: false; error: string };

export type CommitOutcome =
    | {
          ok: true;
          version: number;
          message: string | null;
          createdAt: Date;
          fileCount: number;
          tree: string;
          hash: string;
      }
    | {
          ok: true;
          unchanged: true;
          version: number;
          tree: string;
      }
    | { ok: false; reason: "conflict"; currentVersion: number };

/**
 * 解析整树提交请求体：`files`（内联内容）与 `manifest`（对象引用）二选一。
 *
 * - `files` 文本直接传字符串、二进制传 `{ b64, contentType? }`；
 * - `manifest` 传 `name → hash`（或 `name → { hash, contentType? }`），
 *   服务端从对象库按哈希解析字节，供客户端先增量上传缺失对象再提交。
 *
 * 逐条校验文件名/哈希/大小，任一不合法整体拒绝（保证提交原子）。
 *
 * @param workId - 作品 ID（manifest 模式解析对象用）。
 * @param body - 已解析的请求体。
 */
export async function parseCommitPayload(
    workId: string,
    body: JsonBody,
): Promise<CommitParseResult> {
    const hasFiles = body.files !== undefined;
    const hasManifest = body.manifest !== undefined;
    if (hasFiles === hasManifest) {
        return { ok: false, error: "files 与 manifest 必须二选一" };
    }
    if (hasFiles) {
        return parseCommitFiles(body);
    }
    return resolveCommitManifest(workId, body);
}

/**
 * 解析整树提交请求体里的 files 字段（内联内容模式）。
 */
export function parseCommitFiles(body: JsonBody): CommitParseResult {
    const raw = body.files;
    if (
        raw === undefined ||
        raw === null ||
        typeof raw !== "object" ||
        Array.isArray(raw)
    ) {
        return { ok: false, error: "files 必须是文件路径到内容的映射" };
    }

    const files: CommitFile[] = [];
    for (const [name, value] of Object.entries(raw)) {
        if (!isValidFileName(name)) {
            return { ok: false, error: `文件名不合法: ${name}` };
        }

        let bytes: Uint8Array;
        let contentType: string | null;
        if (typeof value === "string") {
            bytes = fromText(value);
            contentType = null;
        } else if (isB64Payload(value)) {
            const decoded = decodePayload(value.b64, true);
            if (!decoded.ok) {
                return {
                    ok: false,
                    error: `文件 ${name} 的 base64 内容不合法`,
                };
            }
            bytes = decoded.bytes;
            contentType = value.contentType || "application/octet-stream";
        } else {
            return { ok: false, error: `文件 ${name} 的内容格式不合法` };
        }

        if (exceedsFileSizeLimit(bytes.byteLength)) {
            return { ok: false, error: fileSizeLimitMessage(name) };
        }
        files.push({ name, bytes, contentType });
    }
    return { ok: true, files };
}

/**
 * 解析 manifest 模式：按哈希从对象库读取字节。
 * 缺失的对象返回错误并指明哈希前缀，客户端补传后重试。
 */
async function resolveCommitManifest(
    workId: string,
    body: JsonBody,
): Promise<CommitParseResult> {
    const raw = body.manifest;
    if (
        raw === undefined ||
        raw === null ||
        typeof raw !== "object" ||
        Array.isArray(raw)
    ) {
        return { ok: false, error: "manifest 必须是文件路径到哈希的映射" };
    }

    const storage = getStorage();
    const files: CommitFile[] = [];
    for (const [name, value] of Object.entries(raw)) {
        if (!isValidFileName(name)) {
            return { ok: false, error: `文件名不合法: ${name}` };
        }
        const parsed = parseManifestEntry(name, value);
        if (!parsed.ok) {
            return parsed;
        }

        const bytes = await storage.get(blobStorageKey(workId, parsed.hash));
        if (bytes === null) {
            return {
                ok: false,
                error: `缺少对象 ${parsed.hash.slice(0, 12)}…（${name}），请先上传`,
            };
        }
        if (exceedsFileSizeLimit(bytes.byteLength)) {
            return { ok: false, error: fileSizeLimitMessage(name) };
        }
        files.push({
            name,
            bytes,
            contentType: parsed.contentType ?? null,
        });
    }
    return { ok: true, files };
}

function parseManifestEntry(
    name: string,
    value: unknown,
):
    | { ok: true; hash: string; contentType?: string }
    | { ok: false; error: string } {
    if (typeof value === "string") {
        return isBlobHash(value)
            ? { ok: true, hash: value }
            : { ok: false, error: `文件 ${name} 的哈希不合法` };
    }
    if (
        typeof value === "object" &&
        value !== null &&
        typeof (value as { hash?: unknown }).hash === "string"
    ) {
        const hash = (value as { hash: string }).hash;
        if (!isBlobHash(hash)) {
            return { ok: false, error: `文件 ${name} 的哈希不合法` };
        }
        const contentType = (value as { contentType?: unknown }).contentType;
        return {
            ok: true,
            hash,
            contentType:
                typeof contentType === "string" && contentType.length > 0
                    ? contentType
                    : undefined,
        };
    }
    return { ok: false, error: `文件 ${name} 的清单格式不合法` };
}

/**
 * 整树提交（git 式 commit）。
 *
 * 把传入的文件树整体写入当前工作区并生成一个版本快照：
 * - 快照 blob 按内容哈希寻址，相同内容只存一份；
 * - 未变化的文件跳过写入，不递增文件版本（并发比对、批量写入）；
 * - 传入树中不存在的当前文件会被删除（整树替换语义）；
 * - 提交树与当前工作区完全一致时短路返回 unchanged，不产生新版本；
 * - `baseVersion` 与当前最新版本不一致时返回 conflict，供客户端拉取后重试。
 *
 * @param input.workId - 作品 ID。
 * @param input.message - 版本说明。
 * @param input.files - 提交的完整文件树。
 * @param input.baseVersion - 客户端基于的最新版本号（CAS 用）。
 * @param input.userId - 提交者用户 ID。
 */
export async function commitWorkTree(input: {
    workId: string;
    message: string | null;
    files: CommitFile[];
    baseVersion?: number;
    userId?: string | null;
}): Promise<CommitOutcome> {
    const { workId, message, files, baseVersion, userId } = input;
    const storage = getStorage();

    const [current, version] = await Promise.all([
        listWorkFiles(workId),
        nextVersionNumber(workId),
    ]);
    const currentByKey = new Map(current.map((file) => [file.key, file]));

    if (baseVersion !== undefined && baseVersion !== version - 1) {
        return { ok: false, reason: "conflict", currentVersion: version - 1 };
    }

    const entries = files.map((file) => {
        const hash = sha256Hex(file.bytes);
        return {
            key: fileStorageKey(workId, file.name),
            name: file.name,
            contentType: file.contentType,
            size: file.bytes.byteLength,
            hash,
            bytes: file.bytes,
        };
    });
    const tree = computeTreeHash(
        entries.map((entry) => ({
            key: entry.key,
            name: entry.name,
            contentType: entry.contentType,
            size: entry.size,
            hash: entry.hash,
        })),
    );

    const diff = await diffWorkingTree(storage, workId, currentByKey, entries);
    if (
        diff.changed.length === 0 &&
        diff.additions.length === 0 &&
        diff.deletions.length === 0
    ) {
        return { ok: true, unchanged: true, version: version - 1, tree };
    }

    await writeMissingBlobs(storage, workId, entries);
    await applyWorkingTreeChanges(storage, diff);

    const now = new Date();
    const snapshotFiles: SnapshotFile[] = entries.map((entry) => ({
        key: entry.key,
        name: entry.name,
        contentType: entry.contentType,
        size: entry.size,
        hash: entry.hash,
    }));
    const chain = await buildCommitChain(
        workId,
        (await listVersionSummaries(workId, VERSIONS_PAGE_SIZE)) ?? [],
    );
    const parent = chain.at(-1)?.hash ?? null;
    const hash = computeCommitHash({
        tree,
        parent,
        message,
        createdAt: now.getTime(),
    });
    const snapshot: Snapshot = {
        version,
        message,
        createdAt: now.getTime(),
        files: snapshotFiles,
        tree,
        hash,
        parent,
    };
    await storage.put(
        snapshotStorageKey(workId, version),
        serializeSnapshot(snapshot),
        { contentType: "application/json" },
    );
    await storage.put(
        commitStorageKey(workId, hash),
        serializeSnapshot(snapshot),
        { contentType: "application/json" },
    );
    await insertVersion({
        workId,
        version,
        snapshotKey: snapshotStorageKey(workId, version),
        message,
        userId: userId ?? null,
        tree,
        hash,
        parent,
        createdAt: now,
    });
    await touchWork(workId);

    return {
        ok: true,
        version,
        message,
        createdAt: now,
        fileCount: entries.length,
        tree,
        hash,
    };
}

/**
 * 按内容哈希写入缺失的快照 blob（同哈希只检查一次，并发存在性检查、批量写入）。
 */
async function writeMissingBlobs(
    storage: StorageAdapter,
    workId: string,
    entries: Array<{ hash: string; bytes: Uint8Array }>,
): Promise<void> {
    const byHash = new Map<string, Uint8Array>();
    for (const entry of entries) {
        byHash.set(entry.hash, entry.bytes);
    }
    const hashes = [...byHash.keys()];
    const missing = await mapLimit(hashes, IO_CONCURRENCY, async (hash) => {
        const key = blobStorageKey(workId, hash);
        return (await storage.get(key)) === null ? hash : null;
    });
    await mapLimit(
        missing.filter((hash): hash is string => hash !== null),
        IO_CONCURRENCY,
        (hash) =>
            storage.put(
                blobStorageKey(workId, hash),
                byHash.get(hash) as Uint8Array,
            ),
    );
}

interface WorkingTreeDiff {
    additions: Array<{
        workId: string;
        key: string;
        name: string;
        size: number;
        contentType: string | null;
        bytes: Uint8Array;
    }>;
    changed: Array<{
        row: WorkFileRow;
        entry: {
            key: string;
            size: number;
            contentType: string | null;
            bytes: Uint8Array;
        };
    }>;
    deletions: WorkFileRow[];
}

/**
 * 并发比对提交树与当前工作区，得出新增/变更/删除集合。
 * 全部比对完成前不写任何内容，保证「无变化」可以整体短路。
 */
async function diffWorkingTree(
    storage: StorageAdapter,
    workId: string,
    currentByKey: Map<string, WorkFileRow>,
    entries: Array<{
        key: string;
        name: string;
        contentType: string | null;
        size: number;
        bytes: Uint8Array;
    }>,
): Promise<WorkingTreeDiff> {
    const submittedKeys = new Set(entries.map((entry) => entry.key));

    const additions: WorkingTreeDiff["additions"] = [];
    const existing: Array<{
        row: WorkFileRow;
        entry: (typeof entries)[number];
    }> = [];
    for (const entry of entries) {
        const row = currentByKey.get(entry.key);
        if (row === undefined) {
            additions.push({
                workId,
                key: entry.key,
                name: entry.name,
                size: entry.size,
                contentType: entry.contentType,
                bytes: entry.bytes,
            });
        } else {
            existing.push({ row, entry });
        }
    }

    const compared = await mapLimit(
        existing,
        IO_CONCURRENCY,
        async ({ row, entry }) => {
            const stored = await storage.get(entry.key);
            return {
                row,
                entry,
                changed: stored === null || !bytesEqual(stored, entry.bytes),
            };
        },
    );

    return {
        additions,
        changed: compared
            .filter((result) => result.changed)
            .map(({ row, entry }) => ({
                row,
                entry: {
                    key: entry.key,
                    size: entry.size,
                    contentType: entry.contentType,
                    bytes: entry.bytes,
                },
            })),
        deletions: [...currentByKey.values()].filter(
            (row) => !submittedKeys.has(row.key),
        ),
    };
}

/**
 * 把差异应用到工作区：并发写变更/新增内容，再批量更新文件行与删除。
 */
async function applyWorkingTreeChanges(
    storage: StorageAdapter,
    diff: WorkingTreeDiff,
): Promise<void> {
    await mapLimit(diff.changed, IO_CONCURRENCY, ({ entry }) =>
        storage.put(entry.key, entry.bytes, {
            contentType: entry.contentType ?? undefined,
        }),
    );
    await mapLimit(diff.additions, IO_CONCURRENCY, (entry) =>
        storage.put(entry.key, entry.bytes, {
            contentType: entry.contentType ?? undefined,
        }),
    );

    await Promise.all(
        diff.changed.map(({ row, entry }) =>
            bumpWorkFileVersion(row.id, entry.size),
        ),
    );
    if (diff.additions.length > 0) {
        await insertWorkFiles(diff.additions);
    }
    await mapLimit(diff.deletions, IO_CONCURRENCY, (row) =>
        storage.delete(row.key),
    );
    await Promise.all(diff.deletions.map((row) => deleteWorkFile(row.id)));
}

function isB64Payload(
    value: unknown,
): value is { b64: string; contentType?: string } {
    return (
        typeof value === "object" &&
        value !== null &&
        typeof (value as { b64?: unknown }).b64 === "string"
    );
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

function sha256Hex(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex");
}
