import type { Context } from "hono";

/**
 * 内容寻址资源（对象/提交对象）永久缓存。
 * 内容不可变，命中后无需再请求服务器。
 */
export function cacheImmutable(c: Context) {
    c.header("Cache-Control", "public, max-age=31536000, immutable");
}

/**
 * 可变清单（repo/versions）的 ETag 再验证缓存。
 * 写入 ETag 与 `no-cache`（必须回源验证）；客户端携带相同
 * `If-None-Match` 时返回 true，调用方直接回 304 即可。
 *
 * @param c - Hono 上下文。
 * @param updatedAt - 资源最近变更时间（作品 updatedAt）；null 时不发 ETag。
 * @returns 是否命中（应返回 304）。
 */
export function applyEtag(
    c: Context,
    updatedAt: Date | number | null,
): boolean {
    const raw = updatedAt instanceof Date ? updatedAt.getTime() : updatedAt;
    c.header("Cache-Control", "no-cache");
    if (raw === null || raw === undefined) {
        return false;
    }
    const etag = `"${raw}"`;
    c.header("ETag", etag);
    return c.req.header("if-none-match") === etag;
}
