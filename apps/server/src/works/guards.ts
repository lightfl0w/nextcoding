import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { type AuthenticatedEnv, readSession } from "../http/guards.js";
import { jsonError } from "../http/responses.js";
import { findWorkAccess, findWorkOwnerId } from "./repository.js";

export const requireWorkAuthor = createMiddleware<AuthenticatedEnv>(
    async (c, next) => {
        const [session, ownerId] = await Promise.all([
            readSession(c),
            findWorkOwnerId(c.req.param("id") ?? ""),
        ]);

        if (!session?.user) {
            return jsonError(c, "未登录", 401);
        }
        if (!ownerId) {
            return jsonError(c, "作品不存在", 404);
        }
        if (ownerId !== session.user.id) {
            return jsonError(c, "无权操作", 403);
        }

        c.set("userId", session.user.id);
        c.set("userName", session.user.name ?? null);
        await next();
    },
);

export type WorkReadAccess =
    | { ok: true; viewerId: string | null }
    | { ok: false };

/**
 * 校验作品是否可被当前请求读取。
 *
 * 已发布作品对所有人可见；草稿仅作者本人可见。未登录访问草稿一律拒绝，
 * 并统一返回 404 以免泄露作品是否存在。
 *
 * @param c - Hono 上下文。
 * @param workId - 作品 ID。
 * @returns 允许时附带 viewerId（可能为 null），拒绝时返回 `{ ok: false }`。
 */
export async function authorizeWorkRead(
    c: Context,
    workId: string,
): Promise<WorkReadAccess> {
    const [work, session] = await Promise.all([
        findWorkAccess(workId),
        readSession(c),
    ]);
    if (!work) {
        return { ok: false };
    }
    if (work.status !== "published" && work.userId !== session?.user?.id) {
        return { ok: false };
    }
    return { ok: true, viewerId: session?.user?.id ?? null };
}
