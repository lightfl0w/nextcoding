import { Hono } from "hono";
import { readSession } from "../http/guards.js";
import { jsonError } from "../http/responses.js";
import { findWorkAccess } from "../works/repository.js";
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

/**
 * 用户上传内容统一作为「不可信」资源返回：禁止 MIME 嗅探，并在顶层导航
 * 时以沙箱隔离，防止 SVG 等文件携带脚本造成存储型 XSS。
 */
const UNTRUSTED_CONTENT_HEADERS: Record<string, string> = {
    "x-content-type-options": "nosniff",
    "content-security-policy": "sandbox",
    "referrer-policy": "no-referrer",
};

function contentTypeOf(key: string): string {
    const ext = key.split(".").pop()?.toLowerCase() ?? "";
    return CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream";
}

/**
 * 判断某个存储对象是否可被当前请求读取。
 *
 * 头像与模板封面为公开资源；作品相关对象（文件、快照、blob）仅在作品已发布
 * 或请求者为作者本人时可读，否则统一拒绝。
 */
async function canReadStorageKey(
    key: string,
    session: Awaited<ReturnType<typeof readSession>>,
): Promise<boolean> {
    if (key.startsWith("avatars/") || key.startsWith("template-covers/")) {
        return true;
    }
    const match = key.match(/^works\/([^/]+)\//);
    if (!match) {
        return false;
    }
    const work = await findWorkAccess(match[1]);
    if (!work) {
        return false;
    }
    return work.status === "published" || work.userId === session?.user?.id;
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

    const session = key.startsWith("works/") ? await readSession(c) : null;
    if (!(await canReadStorageKey(key, session))) {
        return jsonError(c, "文件不存在", 404);
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
        headers: {
            "content-type": contentType,
            ...UNTRUSTED_CONTENT_HEADERS,
        },
    });
});
