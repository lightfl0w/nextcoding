import { Hono } from "hono";
import { applyEtag } from "../../http/cache.js";
import type { AuthenticatedEnv } from "../../http/guards.js";
import { jsonError, readJsonBody, readTrimmed } from "../../http/responses.js";
import { getStorage } from "../../storage/storageClient.js";
import { commitWorkTree, parseCommitPayload } from "../commit.js";
import { authorizeWorkRead, requireWorkAuthor } from "../guards.js";
import { VERSIONS_PAGE_SIZE } from "../limits.js";
import {
    commitStorageKey,
    fileNameFromKey,
    parseVersionNumber,
    snapshotStorageKey,
} from "../naming.js";
import {
    bumpWorkFileVersion,
    deleteVersion,
    deleteWorkFile,
    findVersion,
    findWorkUpdatedAt,
    insertVersion,
    insertWorkFiles,
    listVersionSummaries,
    listWorkFiles,
    mapWorkFilesByKey,
    nextVersionNumber,
    renameVersionMessage,
    touchWork,
} from "../repository.js";
import {
    buildCommitChain,
    captureFiles,
    computeCommitHash,
    computeTreeHash,
    parseSnapshot,
    resolveSnapshotFileBytes,
    resolveSnapshotFileContent,
    type Snapshot,
    type SnapshotFile,
    serializeSnapshot,
    snapshotFilesOf,
} from "../snapshot.js";

export const versionRoutes = new Hono<AuthenticatedEnv>();

versionRoutes.get("/:id/versions", async (c) => {
    const workId = c.req.param("id");
    const access = await authorizeWorkRead(c, workId);
    if (!access.ok) {
        return jsonError(c, "作品不存在", 404);
    }
    if (applyEtag(c, await findWorkUpdatedAt(workId))) {
        return c.body(null, 304);
    }

    const rows = await listVersionSummaries(workId, VERSIONS_PAGE_SIZE);
    return c.json(
        rows.map((row) => ({
            version: row.version,
            message: row.message,
            createdAt: row.createdAt,
            author:
                row.authorId !== null && row.authorId !== undefined
                    ? { id: row.authorId, name: row.authorName ?? null }
                    : null,
        })),
    );
});

versionRoutes.get("/:id/versions/:version", async (c) => {
    const workId = c.req.param("id");
    const access = await authorizeWorkRead(c, workId);
    if (!access.ok) {
        return jsonError(c, "作品不存在", 404);
    }

    const version = parseVersionNumber(c.req.param("version"));
    if (version === null) {
        return jsonError(c, "版本号不合法", 400);
    }

    const raw = await readSnapshotBytes(workId, version);
    if (raw === "missing-version") {
        return jsonError(c, "版本不存在", 404);
    }
    if (raw === "missing-snapshot") {
        return jsonError(c, "快照数据丢失", 500);
    }

    const snapshot = parseSnapshot(raw);
    const files = await Promise.all(
        snapshot.files.map(async (file) => {
            const resolved = await resolveSnapshotFileContent(workId, file);
            return {
                ...file,
                content: resolved.content,
                encoding: resolved.encoding,
            };
        }),
    );
    return c.json({ ...snapshot, files });
});

versionRoutes.post("/:id/versions", requireWorkAuthor, async (c) => {
    const workId = c.req.param("id");
    const body = await readJsonBody(c);
    const message = readTrimmed(body, "message") || null;

    const files = await listWorkFiles(workId);
    const [entries, version] = await Promise.all([
        captureFiles(files),
        nextVersionNumber(workId),
    ]);

    const createdAt = new Date();
    const snapshotKey = snapshotStorageKey(workId, version);
    const tree = computeTreeHash(entries);
    const chain = await buildCommitChain(
        workId,
        (await listVersionSummaries(workId, VERSIONS_PAGE_SIZE)) ?? [],
    );
    const parent = chain.at(-1)?.hash ?? null;
    const hash = computeCommitHash({
        tree,
        parent,
        message,
        createdAt: createdAt.getTime(),
    });
    const snapshot: Snapshot = {
        version,
        message,
        createdAt: createdAt.getTime(),
        files: entries,
        tree,
        hash,
        parent,
    };

    await getStorage().put(snapshotKey, serializeSnapshot(snapshot), {
        contentType: "application/json",
    });
    await getStorage().put(
        commitStorageKey(workId, hash),
        serializeSnapshot(snapshot),
        {
            contentType: "application/json",
        },
    );
    await insertVersion({
        workId,
        version,
        snapshotKey,
        message,
        userId: c.get("userId"),
        tree,
        hash,
        parent,
        createdAt,
    });
    await touchWork(workId);

    return c.json(
        {
            id: workId,
            version,
            message,
            createdAt,
            fileCount: entries.length,
            tree,
            hash,
        },
        201,
    );
});

/**
 * 整树提交（git 式 commit）：
 * - `files`：完整文件树，文本传字符串、二进制传 `{ b64, contentType? }`；
 * - `manifest`：`name → hash`（或 `name → { hash, contentType? }`）引用对象库，
 *   配合「先增量上传缺失对象再提交」的增量同步。
 * 一次请求原子地替换工作区并生成版本快照。
 * 携带 `baseVersion` 时校验版本（类似 git 非快进拒绝），
 * 不匹配返回 409 与当前最新版本号，客户端可拉取后重试。
 */
versionRoutes.put("/:id/versions", requireWorkAuthor, async (c) => {
    const workId = c.req.param("id");
    const body = await readJsonBody(c);

    const parsed = await parseCommitPayload(workId, body);
    if (!parsed.ok) {
        return jsonError(c, parsed.error, 400);
    }

    const outcome = await commitWorkTree({
        workId,
        message: readTrimmed(body, "message") || null,
        files: parsed.files,
        baseVersion: readOptionalVersion(body.baseVersion),
        userId: c.get("userId"),
    });
    if (!outcome.ok) {
        return c.json(
            {
                error: "作品已被他人更新，请先获取最新版本",
                currentVersion: outcome.currentVersion,
            },
            409,
        );
    }
    if ("unchanged" in outcome) {
        return c.json(
            {
                ok: true,
                unchanged: true,
                version: outcome.version,
                tree: outcome.tree,
            },
            200,
        );
    }

    return c.json(
        {
            id: workId,
            version: outcome.version,
            message: outcome.message,
            createdAt: outcome.createdAt,
            fileCount: outcome.fileCount,
            tree: outcome.tree,
            hash: outcome.hash,
        },
        201,
    );
});

versionRoutes.post(
    "/:id/versions/:version/restore",
    requireWorkAuthor,
    async (c) => {
        const workId = c.req.param("id");
        const version = parseVersionNumber(c.req.param("version"));
        if (version === null) {
            return jsonError(c, "版本号不合法", 400);
        }

        const raw = await readSnapshotBytes(workId, version);
        if (raw === "missing-version") {
            return jsonError(c, "版本不存在", 404);
        }
        if (raw === "missing-snapshot") {
            return jsonError(c, "快照数据丢失", 500);
        }

        const files = snapshotFilesOf(parseSnapshot(raw));
        await restoreFiles(workId, files);

        return c.json({
            ok: true,
            restoredVersion: version,
            files: files.length,
        });
    },
);

versionRoutes.delete("/:id/versions/:version", requireWorkAuthor, async (c) => {
    const workId = c.req.param("id");
    const version = parseVersionNumber(c.req.param("version"));
    if (version === null) {
        return jsonError(c, "版本号不合法", 400);
    }

    const row = await findVersion(workId, version);
    if (!row) {
        return jsonError(c, "版本不存在", 404);
    }

    await getStorage().delete(row.snapshotKey);
    await deleteVersion(workId, version);
    await touchWork(workId);

    return c.json({ ok: true, deletedVersion: version });
});

versionRoutes.patch("/:id/versions/:version", requireWorkAuthor, async (c) => {
    const workId = c.req.param("id");
    const version = parseVersionNumber(c.req.param("version"));
    if (version === null) {
        return jsonError(c, "版本号不合法", 400);
    }

    const body = await readJsonBody(c);
    const message = readTrimmed(body, "message") || null;
    if (!(await findVersion(workId, version))) {
        return jsonError(c, "版本不存在", 404);
    }

    await renameVersionMessage(workId, version, message);
    await touchWork(workId);

    return c.json({ ok: true, version, message });
});

async function restoreFiles(workId: string, files: SnapshotFile[]) {
    const payloads = await Promise.all(
        files.map(async (file) => ({
            file,
            bytes: await resolveSnapshotFileBytes(workId, file),
        })),
    );

    const existingByKey = await mapWorkFilesByKey(
        workId,
        payloads.map(({ file }) => file.key),
    );

    const storage = getStorage();
    await Promise.all(
        payloads.map(({ file, bytes }) =>
            storage.put(file.key, bytes, {
                contentType: file.contentType ?? undefined,
            }),
        ),
    );

    const revivals: Array<Promise<unknown>> = [];
    const additions: Array<{
        workId: string;
        key: string;
        name: string;
        size: number;
        contentType: string | null;
    }> = [];

    for (const { file, bytes } of payloads) {
        const existing = existingByKey.get(file.key);
        if (existing) {
            revivals.push(bumpWorkFileVersion(existing.id, bytes.byteLength));
            continue;
        }
        additions.push({
            workId,
            key: file.key,
            name: file.name || fileNameFromKey(file.key),
            size: bytes.byteLength,
            contentType: file.contentType ?? null,
        });
    }

    await Promise.all(revivals);
    await insertWorkFiles(additions);
    await removeStaleFiles(
        workId,
        new Set(payloads.map(({ file }) => file.key)),
    );
}

/**
 * 删除当前存在但快照中不存在的文件，让回滚精确还原到该版本。
 * @param workId - 作品 ID。
 * @param snapshotKeys - 快照中的文件 key 集合。
 */
async function removeStaleFiles(
    workId: string,
    snapshotKeys: ReadonlySet<string>,
) {
    const current = await listWorkFiles(workId);
    const stale = current.filter((file) => !snapshotKeys.has(file.key));
    if (stale.length === 0) {
        return;
    }

    const storage = getStorage();
    await Promise.all(stale.map((file) => storage.delete(file.key)));
    await Promise.all(stale.map((file) => deleteWorkFile(file.id)));
}

async function readSnapshotBytes(
    workId: string,
    version: number,
): Promise<Uint8Array | "missing-version" | "missing-snapshot"> {
    const row = await findVersion(workId, version);
    if (!row) {
        return "missing-version";
    }

    const raw = await getStorage().get(row.snapshotKey);
    return raw ?? "missing-snapshot";
}

/**
 * 读取可选的 baseVersion（整树提交的乐观锁版本号）。
 * @param raw - 请求体里的原始值；非非负整数视为未提供。
 */
function readOptionalVersion(raw: unknown): number | undefined {
    if (typeof raw !== "number") {
        return undefined;
    }
    return Number.isInteger(raw) && raw >= 0 ? raw : undefined;
}
