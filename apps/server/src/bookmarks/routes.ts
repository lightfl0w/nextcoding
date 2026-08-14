import { Hono } from "hono";
import {
    type AuthenticatedEnv,
    readSession,
    requireSession,
} from "../http/guards.js";
import { jsonError } from "../http/responses.js";
import { findPublishedWorkOwnerId } from "../works/repository.js";
import { toWorkSummary } from "../works/serializers.js";
import {
    deleteBookmark,
    findBookmark,
    findBookmarkVisibility,
    insertBookmark,
    listUserBookmarks,
} from "./repository.js";

export const bookmarkRoutes = new Hono<AuthenticatedEnv>();

bookmarkRoutes.get("/:id/bookmark", requireSession, async (c) => {
    const workId = c.req.param("id");
    const userId = c.get("userId");

    const existing = await findBookmark(userId, workId);
    return c.json({ bookmarked: Boolean(existing) });
});

bookmarkRoutes.post("/:id/bookmark", requireSession, async (c) => {
    const workId = c.req.param("id");
    const userId = c.get("userId");

    const ownerId = await findPublishedWorkOwnerId(workId);
    if (!ownerId) {
        return jsonError(c, "作品不存在", 404);
    }
    if (ownerId === userId) {
        return jsonError(c, "不能收藏自己的作品", 400);
    }

    const existing = await findBookmark(userId, workId);
    if (existing) {
        return jsonError(c, "已经收藏过这个作品了", 409);
    }

    await insertBookmark(userId, workId);
    return c.json({ bookmarked: true });
});

bookmarkRoutes.delete("/:id/bookmark", requireSession, async (c) => {
    const workId = c.req.param("id");
    const userId = c.get("userId");

    const existing = await findBookmark(userId, workId);
    if (!existing) {
        return jsonError(c, "未收藏该作品", 404);
    }

    await deleteBookmark(userId, workId);
    return c.json({ bookmarked: false });
});

bookmarkRoutes.get("/user/:userId/bookmarks", async (c) => {
    const targetUserId = c.req.param("userId");
    const limitParam = c.req.query("limit");
    const offsetParam = c.req.query("offset");
    const limit = limitParam
        ? Math.min(Math.max(Number(limitParam), 1), 50)
        : 20;
    const offset = offsetParam ? Math.max(Number(offsetParam), 0) : 0;

    const session = await readSession(c);
    const isOwner = session?.user?.id === targetUserId;
    if (!isOwner) {
        const visibility = await findBookmarkVisibility(targetUserId);
        if (!visibility?.showBookmarks) {
            return jsonError(c, "该用户的收藏列表不公开", 403);
        }
    }

    const rows = await listUserBookmarks(targetUserId, limit, offset);
    return c.json(
        rows.map((row) =>
            toWorkSummary({
                id: row.workId,
                title: row.title,
                description: row.description,
                coverUrl: row.coverUrl,
                tags: row.tags,
                views: row.views,
                likes: row.likes,
                sparks: row.sparks,
                createdAt: row.workCreatedAt,
                authorId: row.authorId,
                authorName: row.authorName,
                authorImage: row.authorImage,
                authorBio: row.authorBio,
            }),
        ),
    );
});
