import { auth } from "@nextcoding/auth";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { jsonError } from "../http/responses.js";
import { findWorkOwnerId } from "./repository.js";

export interface AuthenticatedEnv {
    Variables: {
        userId: string;
        userName: string | null;
    };
}

export const requireSession = createMiddleware<AuthenticatedEnv>(
    async (c, next) => {
        const session = await readSession(c);
        if (!session?.user) return jsonError(c, "未登录", 401);

        c.set("userId", session.user.id);
        c.set("userName", session.user.name ?? null);
        await next();
    },
);

export const requireWorkAuthor = createMiddleware<AuthenticatedEnv>(
    async (c, next) => {
        const [session, ownerId] = await Promise.all([
            readSession(c),
            findWorkOwnerId(c.req.param("id") ?? ""),
        ]);

        if (!session?.user) return jsonError(c, "未登录", 401);
        if (!ownerId) return jsonError(c, "作品不存在", 404);
        if (ownerId !== session.user.id) return jsonError(c, "无权操作", 403);

        c.set("userId", session.user.id);
        c.set("userName", session.user.name ?? null);
        await next();
    },
);

export function readSession(c: Context) {
    return auth.api.getSession({ headers: c.req.raw.headers });
}
