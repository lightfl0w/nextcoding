import { Hono } from "hono";
import { jsonError } from "../http/responses.js";
import { getStorage } from "./storageClient.js";

const STORAGE_ROUTE_PREFIX = "/api/storage";

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
};

function contentTypeOf(key: string): string {
    const ext = key.split(".").pop()?.toLowerCase() ?? "";
    return CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream";
}

export const storageRoutes = new Hono();

storageRoutes.get("/*", async (c) => {
    const rest = c.req.path
        .slice(STORAGE_ROUTE_PREFIX.length)
        .replace(/^\/+/, "");
    if (!rest) {
        return jsonError(c, "缺少 key", 400);
    }
    let key: string;
    try {
        key = decodeURIComponent(rest);
    } catch {
        return jsonError(c, "缺少 key", 400);
    }

    let data: Uint8Array | null;
    try {
        data = await getStorage().get(key);
    } catch (err) {
        console.error(`读取存储对象失败: ${key}`, err);
        return jsonError(c, "存储服务暂不可用", 500);
    }
    if (!data) {
        return jsonError(c, "文件不存在", 404);
    }

    const contentType = contentTypeOf(key);
    return new Response(new Blob([data as BlobPart], { type: contentType }), {
        status: 200,
        headers: { "content-type": contentType },
    });
});
