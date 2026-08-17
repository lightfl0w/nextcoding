import { Hono } from "hono";
import { checkAndUnlockAchievements } from "../../achievements/checker.js";
import { insertActivity } from "../../activities/repository.js";
import { type AuthenticatedEnv, requireSession } from "../../http/guards.js";
import { jsonError } from "../../http/responses.js";
import { publishNewNotification } from "../notificationBus.js";
import { findPublishedWorkOwnerId } from "../repository.js";
import {
    bumpWorkSparks,
    findSpark,
    insertNotification,
    insertSpark,
} from "../socialRepository.js";
import { consumeSpark } from "../sparkBalance.js";

export const sparkRoutes = new Hono<AuthenticatedEnv>();

sparkRoutes.get("/:id/spark", requireSession, async (c) => {
    const sparked = Boolean(
        await findSpark(c.req.param("id"), c.get("userId")),
    );
    return c.json({ sparked });
});

sparkRoutes.post("/:id/spark", requireSession, async (c) => {
    const workId = c.req.param("id");
    const userId = c.get("userId");

    const ownerId = await findPublishedWorkOwnerId(workId);
    if (!ownerId) {
        return jsonError(c, "作品不存在", 404);
    }
    if (ownerId === userId) {
        return jsonError(c, "不能给自己的作品送火花", 400);
    }

    if (await findSpark(workId, userId)) {
        return jsonError(c, "已经给这个作品送过火花了", 409);
    }

    if (!(await consumeSpark(userId))) {
        return jsonError(c, "火花不足，每天送出的火花用完啦，明天再来", 400);
    }

    await insertSpark({ workId, userId });
    await bumpWorkSparks(workId);
    await insertActivity({
        userId,
        type: "spark",
        actorId: userId,
        workId,
    });
    await insertNotification({
        userId: ownerId,
        type: "spark",
        actorId: userId,
        workId,
    });
    await publishNewNotification(ownerId);
    void checkAndUnlockAchievements(userId).catch(() => {});
    void checkAndUnlockAchievements(ownerId).catch(() => {});

    return c.json({ sparked: true });
});
