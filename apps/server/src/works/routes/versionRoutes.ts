import { Hono } from "hono";
import type { AuthenticatedEnv } from "../../http/guards.js";
import { jsonError, readJsonBody, readTrimmed } from "../../http/responses.js";
import { getStorage } from "../../storage/storageClient.js";
import { authorizeWorkRead, requireWorkAuthor } from "../guards.js";
import { VERSIONS_PAGE_SIZE } from "../limits.js";
import {
    fileNameFromKey,
    parseVersionNumber,
    snapshotStorageKey,
} from "../naming.js";
import {
    bumpWorkFileVersion,
    deleteVersion,
    deleteWorkFile,
    findVersion,
    insertVersion,
    insertWorkFiles,
    listVersionSummaries,
    listWorkFiles,
    mapWorkFilesByKey,
    nextVersionNumber,
    renameVersionMessage,
} from "../repository.js";
import {
    captureFiles,
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
    const snapshot: Snapshot = {
        version,
        message,
        createdAt: createdAt.getTime(),
        files: entries,
    };

    await getStorage().put(snapshotKey, serializeSnapshot(snapshot), {
        contentType: "application/json",
    });
    await insertVersion({
        workId,
        version,
        snapshotKey,
        message,
        userId: c.get("userId"),
        createdAt,
    });

    return c.json(
        { id: workId, version, message, createdAt, fileCount: entries.length },
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
