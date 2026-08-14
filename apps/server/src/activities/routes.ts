import { Hono } from "hono";
import {
    type AuthenticatedEnv,
    readSession,
    requireSession,
} from "../http/guards.js";
import { jsonError } from "../http/responses.js";
import {
    ACTIVITY_PAGE_SIZE,
    findActivityVisibility,
    listFeedActivities,
    listUserActivities,
    userExists,
} from "./repository.js";

export const activityUserRoutes = new Hono<AuthenticatedEnv>();

activityUserRoutes.get("/:id/activities", async (c) => {
    const targetUserId = c.req.param("id");

    const [exists, session] = await Promise.all([
        userExists(targetUserId),
        readSession(c),
    ]);

    if (!exists) {
        return jsonError(c, "用户不存在", 404);
    }

    const viewerId = session?.user?.id ?? null;
    if (viewerId !== targetUserId) {
        const visibility = await findActivityVisibility(targetUserId);

        if (visibility && !visibility.showActivity) {
            return jsonError(c, "该用户已关闭动态展示", 403);
        }
    }

    const limit = clampActivityLimit(c.req.query("limit"));
    const offset = Number(c.req.query("offset")) || 0;

    const rows = await listUserActivities(targetUserId, limit, offset);
    return c.json(rows.map(toActivity));
});

export const activityFeedRoutes = new Hono<AuthenticatedEnv>();

activityFeedRoutes.get("/feed", requireSession, async (c) => {
    const userId = c.get("userId");
    const limit = clampActivityLimit(c.req.query("limit"));
    const offset = Number(c.req.query("offset")) || 0;

    const rows = await listFeedActivities(userId, limit, offset);
    return c.json(rows.map(toActivity));
});

const ACTIVITY_LIMIT_MAX = 100;

function clampActivityLimit(raw: string | undefined): number {
    const requested = Number(raw);
    if (!Number.isFinite(requested) || requested <= 0) {
        return ACTIVITY_PAGE_SIZE;
    }
    return Math.min(requested, ACTIVITY_LIMIT_MAX);
}

interface ActivityRow {
    id: string;
    type: string;
    createdAt: Date;
    actorId: string | null;
    actorName: string | null;
    actorImage: string | null;
    workId: string | null;
    workTitle: string | null;
    targetUserId: string | null;
    targetUserName: string | null;
    targetUserImage: string | null;
    commentId: string | null;
    commentContent: string | null;
}

function toActivity(row: ActivityRow) {
    return {
        id: row.id,
        type: row.type,
        createdAt: row.createdAt,
        actor: row.actorId
            ? { id: row.actorId, name: row.actorName, image: row.actorImage }
            : null,
        work: row.workId ? { id: row.workId, title: row.workTitle } : null,
        targetUser: row.targetUserId
            ? {
                  id: row.targetUserId,
                  name: row.targetUserName,
                  image: row.targetUserImage,
              }
            : null,
        comment: row.commentId
            ? { id: row.commentId, content: row.commentContent }
            : null,
    };
}
