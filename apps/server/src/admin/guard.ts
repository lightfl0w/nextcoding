import { auth } from "@nextcoding/auth";
import { createMiddleware } from "hono/factory";
import { jsonError } from "../http/responses.js";

export interface AdminEnv {
    Variables: {
        adminId: string;
        adminName: string | null;
    };
}

/**
 * 管理员守卫：要求已登录且角色为 admin。
 * 未登录返回 401，非管理员返回 403。
 */
export const requireAdmin = createMiddleware<AdminEnv>(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) {
        return jsonError(c, "未登录", 401);
    }
    if (session.user.role !== "admin") {
        return jsonError(c, "需要管理员权限", 403);
    }
    c.set("adminId", session.user.id);
    c.set("adminName", session.user.name ?? null);
    await next();
});
