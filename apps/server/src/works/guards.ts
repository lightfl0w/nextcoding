import { createMiddleware } from "hono/factory";
import { type AuthenticatedEnv, readSession } from "../http/guards.js";
import { jsonError } from "../http/responses.js";
import { findWorkOwnerId } from "./repository.js";

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
