import { Hono } from "hono";
import type { AuthenticatedEnv } from "../../http/guards.js";
import {
    type JsonBody,
    jsonError,
    readFlag,
    readJsonBody,
    readString,
    readTrimmed,
} from "../../http/responses.js";
import { getStorage } from "../../storage/storageClient.js";
import {
    type DecodeResult,
    decodePayload,
    isBinaryPayload,
    toBase64,
    toText,
} from "../content.js";
import { requireWorkAuthor, authorizeWorkRead } from "../guards.js";
import { exceedsFileSizeLimit, fileSizeLimitMessage } from "../limits.js";
import { fileStorageKey, isValidFileName } from "../naming.js";
import {
    deleteWorkFile,
    deleteWorkFilesByIds,
    findWorkFileByKey,
    insertWorkFile,
    listWorkFiles,
    listWorkFilesByPrefix,
    renameWorkFile,
    setWorkFileVersion,
    workExists,
} from "../repository.js";

export const fileRoutes = new Hono<AuthenticatedEnv>();

fileRoutes.get("/:id/files", async (c) => {
    const workId = c.req.param("id");
    const access = await authorizeWorkRead(c, workId);
    if (!access.ok) {
        return jsonError(c, "作品不存在", 404);
    }

    const [exists, files] = await Promise.all([
        workExists(workId),
        listWorkFiles(workId),
    ]);
    if (!exists) {
        return jsonError(c, "作品不存在", 404);
    }

    return c.json({ files });
});

fileRoutes.get("/:id/files/content", async (c) => {
    const workId = c.req.param("id");
    const access = await authorizeWorkRead(c, workId);
    if (!access.ok) {
        return jsonError(c, "作品不存在", 404);
    }

    const key = c.req.query("key");
    if (!key) {
        return jsonError(c, "缺少 key", 400);
    }

    const file = await findWorkFileByKey(workId, key);
    if (!file) {
        return jsonError(c, "文件不存在", 404);
    }

    const data = await getStorage().get(file.key);
    if (!data) {
        return jsonError(c, "内容缺失", 404);
    }

    return c.text(
        isBinaryPayload(file.contentType, data) ? toBase64(data) : toText(data),
    );
});

fileRoutes.post("/:id/files", requireWorkAuthor, async (c) => {
    const workId = c.req.param("id");
    const body = await readJsonBody(c);

    const name = readTrimmed(body, "name");
    if (!isValidFileName(name)) {
        return jsonError(c, "文件名不合法", 400);
    }

    const key = fileStorageKey(workId, name);
    if (await findWorkFileByKey(workId, key)) {
        return jsonError(c, "同名文件已存在", 409);
    }

    const decoded = decodeBody(body);
    if (!decoded.ok) {
        return jsonError(c, decoded.reason, 400);
    }
    if (exceedsFileSizeLimit(decoded.bytes.byteLength)) {
        return jsonError(c, fileSizeLimitMessage(), 400);
    }

    const contentType = readString(body, "contentType") || null;
    await getStorage().put(key, decoded.bytes, {
        contentType: contentType ?? undefined,
    });
    await insertWorkFile({
        workId,
        key,
        name,
        size: decoded.bytes.byteLength,
        contentType,
    });

    return c.json(
        { ok: true, key, name, size: decoded.bytes.byteLength, version: 1 },
        201,
    );
});

fileRoutes.put("/:id/files/content", requireWorkAuthor, async (c) => {
    const body = await readJsonBody(c);
    const key = readString(body, "key");
    if (!key) {
        return jsonError(c, "缺少 key", 400);
    }

    const file = await findWorkFileByKey(c.req.param("id"), key);
    if (!file) {
        return jsonError(c, "文件不存在", 404);
    }

    const currentVersion = file.version ?? 1;
    if (isStaleWrite(body, currentVersion)) {
        return c.json(
            { error: "文件已被他人修改，请刷新后重试", currentVersion },
            409,
        );
    }

    const decoded = decodeBody(body);
    if (!decoded.ok) {
        return jsonError(c, decoded.reason, 400);
    }
    if (exceedsFileSizeLimit(decoded.bytes.byteLength)) {
        return jsonError(c, fileSizeLimitMessage(), 400);
    }

    const nextVersion = currentVersion + 1;
    await getStorage().put(file.key, decoded.bytes, {
        contentType: file.contentType ?? undefined,
    });
    await setWorkFileVersion(file.id, decoded.bytes.byteLength, nextVersion);

    return c.json({
        ok: true,
        key,
        size: decoded.bytes.byteLength,
        version: nextVersion,
    });
});

fileRoutes.patch("/:id/files", requireWorkAuthor, async (c) => {
    const workId = c.req.param("id");
    const body = await readJsonBody(c);

    const key = readString(body, "key");
    if (!key) {
        return jsonError(c, "缺少 key", 400);
    }
    const newName = readTrimmed(body, "newName");
    if (!isValidFileName(newName)) {
        return jsonError(c, "文件名不合法", 400);
    }

    const file = await findWorkFileByKey(workId, key);
    if (!file) {
        return jsonError(c, "文件不存在", 404);
    }

    const newKey = fileStorageKey(workId, newName);
    if (newKey === file.key) {
        return c.json({
            ok: true,
            key: file.key,
            name: file.name,
            size: file.size,
            version: file.version ?? 1,
        });
    }
    if (await findWorkFileByKey(workId, newKey)) {
        return jsonError(c, "同名文件已存在", 409);
    }

    const data = await getStorage().get(file.key);
    if (!data) {
        return jsonError(c, "内容缺失", 404);
    }

    await getStorage().put(newKey, data, {
        contentType: file.contentType ?? undefined,
    });
    await getStorage().delete(file.key);
    await renameWorkFile(file.id, newKey, newName);

    return c.json({
        ok: true,
        key: newKey,
        name: newName,
        size: file.size,
        version: file.version ?? 1,
    });
});

fileRoutes.delete("/:id/files", requireWorkAuthor, async (c) => {
    const key = c.req.query("key");
    if (!key) {
        return jsonError(c, "缺少 key", 400);
    }

    const file = await findWorkFileByKey(c.req.param("id"), key);
    if (!file) {
        return jsonError(c, "文件不存在", 404);
    }

    await getStorage().delete(file.key);
    await deleteWorkFile(file.id);

    return c.json({ ok: true });
});

fileRoutes.delete("/:id/files/folder", requireWorkAuthor, async (c) => {
    const workId = c.req.param("id");
    const folder = c.req.query("name");
    if (!folder || !isValidFileName(folder)) {
        return jsonError(c, "文件夹名不合法", 400);
    }

    const files = await listWorkFilesByPrefix(workId, folder);
    if (files.length === 0) {
        return jsonError(c, "文件夹为空或不存在", 404);
    }

    await Promise.all(files.map((file) => getStorage().delete(file.key)));
    await deleteWorkFilesByIds(files.map((file) => file.id));

    return c.json({ ok: true, deleted: files.length });
});

function decodeBody(body: JsonBody): DecodeResult {
    return decodePayload(
        readString(body, "content"),
        readFlag(body, "isBase64"),
    );
}

function isStaleWrite(body: JsonBody, currentVersion: number): boolean {
    if (body.expectedVersion === undefined) {
        return false;
    }
    const expected = Number(body.expectedVersion);
    return !Number.isInteger(expected) || expected !== currentVersion;
}
