import { Hono } from "hono";
import { jsonError, readJsonBody, readTrimmed } from "../../http/responses.js";
import { getStorage } from "../../storage/storageClient.js";
import { type AuthenticatedEnv, requireWorkAuthor } from "../guards.js";
import { VERSIONS_PAGE_SIZE } from "../limits.js";
import {
    fileNameFromKey,
    parseVersionNumber,
    snapshotStorageKey,
} from "../naming.js";
import {
    bumpWorkFileVersion,
    findVersion,
    insertVersion,
    insertWorkFiles,
    listVersionSummaries,
    listWorkFiles,
    mapWorkFilesByKey,
    nextVersionNumber,
} from "../repository.js";
import {
    captureFiles,
    decodeSnapshotFile,
    parseSnapshot,
    type Snapshot,
    type SnapshotFile,
    serializeSnapshot,
    snapshotFilesOf,
} from "../snapshot.js";

export const versionRoutes = new Hono<AuthenticatedEnv>();

versionRoutes.get("/:id/versions", async (c) => {
    const rows = await listVersionSummaries(
        c.req.param("id"),
        VERSIONS_PAGE_SIZE,
    );
    return c.json(rows);
});

versionRoutes.get("/:id/versions/:version", async (c) => {
    const version = parseVersionNumber(c.req.param("version"));
    if (version === null) return jsonError(c, "版本号不合法", 400);

    const raw = await readSnapshotBytes(c.req.param("id"), version);
    if (raw === "missing-version") return jsonError(c, "版本不存在", 404);
    if (raw === "missing-snapshot") return jsonError(c, "快照数据丢失", 500);

    return c.json(parseSnapshot(raw));
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
        if (version === null) return jsonError(c, "版本号不合法", 400);

        const raw = await readSnapshotBytes(workId, version);
        if (raw === "missing-version") return jsonError(c, "版本不存在", 404);
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

async function restoreFiles(workId: string, files: SnapshotFile[]) {
    const payloads = files.map((file) => ({
        file,
        bytes: decodeSnapshotFile(file),
    }));

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
}

async function readSnapshotBytes(
    workId: string,
    version: number,
): Promise<Uint8Array | "missing-version" | "missing-snapshot"> {
    const row = await findVersion(workId, version);
    if (!row) return "missing-version";

    const raw = await getStorage().get(row.snapshotKey);
    return raw ?? "missing-snapshot";
}
