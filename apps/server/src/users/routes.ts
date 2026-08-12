import { Hono } from "hono";
import { type AuthenticatedEnv, requireSession } from "../http/guards.js";
import { jsonError } from "../http/responses.js";
import {
    countGivenSparks,
    countReceivedSparks,
    deleteFollow,
    findFollow,
    findUserById,
    insertFollow,
} from "./repository.js";

export const userRoutes = new Hono<AuthenticatedEnv>()
    .get("/me/stats", requireSession, async (c) => {
        const userId = c.get("userId");
        const [givenSparks, receivedSparks] = await Promise.all([
            countGivenSparks(userId),
            countReceivedSparks(userId),
        ]);
        return c.json({ givenSparks, receivedSparks });
    })
    .post("/:id/follow", requireSession, async (c) => {
        const targetId = c.req.param("id");
        const actorId = c.get("userId");

        if (!(await findUserById(targetId))) {
            return jsonError(c, "用户不存在", 404);
        }
        if (targetId === actorId) {
            return jsonError(c, "不能关注自己", 400);
        }
        if (await findFollow(actorId, targetId)) {
            return jsonError(c, "已经关注过了", 409);
        }

        await insertFollow({ followerId: actorId, followingId: targetId });
        return c.json({ following: true });
    })
    .delete("/:id/follow", requireSession, async (c) => {
        const targetId = c.req.param("id");
        const actorId = c.get("userId");

        if (targetId === actorId) {
            return jsonError(c, "不能关注自己", 400);
        }

        await deleteFollow(actorId, targetId);
        return c.json({ following: false });
    });
