import { createHash } from "node:crypto";
import { Hono } from "hono";
import { applyEtag, cacheImmutable } from "../../http/cache.js";
import type { AuthenticatedEnv } from "../../http/guards.js";
import { jsonError, readJsonBody } from "../../http/responses.js";
import { getStorage } from "../../storage/storageClient.js";
import { decodePayload } from "../content.js";
import { authorizeWorkRead, requireWorkAuthor } from "../guards.js";
import {
    exceedsFileSizeLimit,
    fileSizeLimitMessage,
    VERSIONS_PAGE_SIZE,
} from "../limits.js";
import { blobStorageKey, commitStorageKey, isBlobHash } from "../naming.js";
import {
    findWorkUpdatedAt,
    listVersionSummaries,
    workExists,
} from "../repository.js";
import { buildCommitChain, parseSnapshot } from "../snapshot.js";

export const repoRoutes = new Hono<AuthenticatedEnv>();

const MAX_HAVE_HASHES = 100_000;

repoRoutes.get("/:id/repo", async (c) => {
    const workId = c.req.param("id");
    const access = await authorizeWorkRead(c, workId);
    if (!access.ok) {
        return jsonError(c, "作品不存在", 404);
    }
    if (!(await workExists(workId))) {
        return jsonError(c, "作品不存在", 404);
    }
    if (applyEtag(c, await findWorkUpdatedAt(workId))) {
        return c.body(null, 304);
    }

    const [summaries, objectKeys] = await Promise.all([
        listVersionSummaries(workId, VERSIONS_PAGE_SIZE),
        listObjectKeys(workId),
    ]);
    const byVersion = new Map(
        (summaries ?? []).map((summary) => [summary.version, summary]),
    );
    const chain = await buildCommitChain(workId, summaries ?? []);

    const refs = chain.map((ref) => {
        const summary = byVersion.get(ref.version);
        return {
            version: ref.version,
            message: ref.message,
            createdAt: new Date(ref.createdAt),
            tree: ref.tree,
            hash: ref.hash,
            parent: ref.parent,
            author:
                summary !== undefined &&
                summary.authorId !== null &&
                summary.authorId !== undefined
                    ? { id: summary.authorId, name: summary.authorName ?? null }
                    : null,
        };
    });

    return c.json({
        head: refs.at(-1) ?? null,
        refs: [...refs].reverse(),
        objects: objectKeys,
    });
});

repoRoutes.get("/:id/commits/:hash", async (c) => {
    const workId = c.req.param("id");
    const access = await authorizeWorkRead(c, workId);
    if (!access.ok) {
        return jsonError(c, "作品不存在", 404);
    }

    const hash = c.req.param("hash");
    if (!isBlobHash(hash)) {
        return jsonError(c, "提交哈希不合法", 400);
    }

    const raw = await getStorage().get(commitStorageKey(workId, hash));
    if (raw === null) {
        return jsonError(c, "提交不存在", 404);
    }
    cacheImmutable(c);
    return c.json(parseSnapshot(raw));
});

repoRoutes.get("/:id/objects/:hash", async (c) => {
    const workId = c.req.param("id");
    const access = await authorizeWorkRead(c, workId);
    if (!access.ok) {
        return jsonError(c, "作品不存在", 404);
    }

    const hash = c.req.param("hash");
    if (!isBlobHash(hash)) {
        return jsonError(c, "对象哈希不合法", 400);
    }

    const raw = await getStorage().get(blobStorageKey(workId, hash));
    if (raw === null) {
        return jsonError(c, "对象不存在", 404);
    }

    cacheImmutable(c);
    c.header("Content-Type", "application/octet-stream");
    const buffer = raw.buffer.slice(
        raw.byteOffset,
        raw.byteOffset + raw.byteLength,
    ) as ArrayBuffer;
    return c.body(buffer);
});

/**
 * 反向 have/want：客户端带上本地已有的哈希集合，服务端只回缺失的对象。
 * 大仓库无需每次下载全部 `objects` 集合，协商成本与差异大小成正比。
 */
repoRoutes.post("/:id/objects/missing", requireWorkAuthor, async (c) => {
    const workId = c.req.param("id");
    const body = await readJsonBody(c);

    const has = body.has;
    if (!Array.isArray(has) || has.some((item) => typeof item !== "string")) {
        return jsonError(c, "has 必须是哈希字符串数组", 400);
    }
    if (has.length > MAX_HAVE_HASHES) {
        return jsonError(c, `has 最多 ${MAX_HAVE_HASHES} 条`, 400);
    }

    const local = new Set(has.filter(isBlobHash));
    const missing = (await listObjectKeys(workId)).filter(
        (hash) => !local.has(hash),
    );
    return c.json({ missing });
});

/**
 * 直传原始字节上传对象（免 base64 膨胀 33%）。
 * 内容哈希校验通过才写入；已存在时幂等跳过。
 */
repoRoutes.put("/:id/objects/:hash", requireWorkAuthor, async (c) => {
    const workId = c.req.param("id");
    const hash = c.req.param("hash");
    if (!isBlobHash(hash)) {
        return jsonError(c, "对象哈希不合法", 400);
    }

    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (sha256Hex(bytes) !== hash) {
        return jsonError(c, "内容与哈希不匹配", 400);
    }
    if (exceedsFileSizeLimit(bytes.byteLength)) {
        return jsonError(c, fileSizeLimitMessage(hash.slice(0, 12)), 400);
    }

    const key = blobStorageKey(workId, hash);
    const existing = (await getStorage().get(key)) !== null;
    if (!existing) {
        await getStorage().put(key, bytes);
    }
    return c.json({ ok: true, uploaded: !existing });
});

repoRoutes.post("/:id/objects", requireWorkAuthor, async (c) => {
    const workId = c.req.param("id");
    const body = await readJsonBody(c);

    const rawObjects = body.objects;
    if (
        rawObjects === undefined ||
        rawObjects === null ||
        typeof rawObjects !== "object" ||
        Array.isArray(rawObjects)
    ) {
        return jsonError(c, "objects 必须是哈希到 base64 内容的映射", 400);
    }

    const storage = getStorage();
    let uploaded = 0;
    for (const [hash, value] of Object.entries(rawObjects)) {
        if (!isBlobHash(hash)) {
            return jsonError(c, `对象哈希不合法: ${hash}`, 400);
        }
        if (typeof value !== "string") {
            return jsonError(
                c,
                `对象 ${hash.slice(0, 12)}… 的内容格式不合法`,
                400,
            );
        }
        const decoded = decodePayload(value, true);
        if (!decoded.ok) {
            return jsonError(
                c,
                `对象 ${hash.slice(0, 12)}… 的 base64 内容不合法`,
                400,
            );
        }
        if (sha256Hex(decoded.bytes) !== hash) {
            return jsonError(
                c,
                `对象 ${hash.slice(0, 12)}… 内容与哈希不匹配`,
                400,
            );
        }
        if (exceedsFileSizeLimit(decoded.bytes.byteLength)) {
            return jsonError(c, fileSizeLimitMessage(hash.slice(0, 12)), 400);
        }

        const key = blobStorageKey(workId, hash);
        if ((await storage.get(key)) !== null) {
            continue;
        }
        await storage.put(key, decoded.bytes);
        uploaded++;
    }

    return c.json({ ok: true, uploaded });
});

/**
 * 服务端对象库当前持有的全部 blob 哈希（增量的「已有集合」）。
 * @returns 排序后的哈希数组。
 */
async function listObjectKeys(workId: string): Promise<string[]> {
    const keys = await getStorage().list(blobStorageKey(workId, ""));
    return keys
        .map((key) => key.split("/").pop() ?? "")
        .filter(isBlobHash)
        .sort();
}

function sha256Hex(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex");
}
