import { auth } from "@nextcoding/auth";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { jsonError } from "./responses.js";

export interface AuthenticatedEnv {
    Variables: {
        userId: string;
        userName: string | null;
    };
}

export const requireSession = createMiddleware<AuthenticatedEnv>(
    async (c, next) => {
        const session = await readSession(c);
        if (!session?.user) {
            return jsonError(c, "未登录", 401);
        }

        c.set("userId", session.user.id);
        c.set("userName", session.user.name ?? null);
        await next();
    },
);

export function readSession(c: Context) {
    return auth.api.getSession({ headers: c.req.raw.headers });
}
