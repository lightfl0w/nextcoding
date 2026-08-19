import { Hono } from "hono";
import { insertActivity } from "../../activities/repository.js";
import { type AuthenticatedEnv, requireSession } from "../../http/guards.js";
import {
    type JsonBody,
    jsonError,
    readJsonBody,
    readString,
    readTrimmed,
} from "../../http/responses.js";
import { authorizeWorkRead } from "../guards.js";
import { COMMENT_MAX_LENGTH, COMMENT_PAGE_SIZE } from "../limits.js";
import { publishNewNotification } from "../notificationBus.js";
import {
    deleteComment,
    findComment,
    findWorkOwnerId,
    insertComment,
    listComments,
    setCommentPinned,
    toggleCommentLike,
    workExists,
} from "../repository.js";
import { toComment } from "../serializers.js";
import { insertNotification } from "../socialRepository.js";

export const commentRoutes = new Hono<AuthenticatedEnv>();

commentRoutes.get("/:id/comments", async (c) => {
    const workId = c.req.param("id");
    const access = await authorizeWorkRead(c, workId);
    if (!access.ok) {
        return jsonError(c, "作品不存在", 404);
    }

    const sort = c.req.query("sort") === "popular" ? "popular" : "time";
    const rows = await listComments(
        workId,
        COMMENT_PAGE_SIZE,
        sort,
        access.viewerId,
    );
    return c.json(rows.map(toComment));
});

commentRoutes.delete("/:id/comments/:commentId", requireSession, async (c) => {
    const workId = c.req.param("id");
    const commentId = c.req.param("commentId");
    const comment = await findComment(commentId);
    if (!comment || comment.workId !== workId) {
        return jsonError(c, "评论不存在", 404);
    }

    const userId = c.get("userId");
    const isCommentAuthor = comment.userId === userId;
    const isWorkOwner = (await findWorkOwnerId(workId)) === userId;
    if (!isCommentAuthor && !isWorkOwner) {
        return jsonError(c, "无权删除该评论", 403);
    }

    await deleteComment(commentId);
    return c.json({ ok: true, id: commentId });
});

commentRoutes.patch(
    "/:id/comments/:commentId/pin",
    requireSession,
    async (c) => {
        const workId = c.req.param("id");
        const commentId = c.req.param("commentId");
        const ownerId = await findWorkOwnerId(workId);
        if (!ownerId) {
            return jsonError(c, "作品不存在", 404);
        }
        const comment = await findComment(commentId);
        if (!comment || comment.workId !== workId) {
            return jsonError(c, "评论不存在", 404);
        }
        if (ownerId !== c.get("userId")) {
            return jsonError(c, "只有作者可以置顶评论", 403);
        }

        const body = await readJsonBody(c);
        const pinned = body?.pinned === true;
        await setCommentPinned(commentId, pinned);
        return c.json({ ok: true, id: commentId, pinned });
    },
);

commentRoutes.post(
    "/:id/comments/:commentId/like",
    requireSession,
    async (c) => {
        const workId = c.req.param("id");
        const commentId = c.req.param("commentId");
        const comment = await findComment(commentId);
        if (!comment || comment.workId !== workId) {
            return jsonError(c, "评论不存在", 404);
        }

        const result = await toggleCommentLike(commentId, c.get("userId"));
        return c.json({ ok: true, id: commentId, ...result });
    },
);

commentRoutes.post("/:id/comments", requireSession, async (c) => {
    const workId = c.req.param("id");
    const [body, exists] = await Promise.all([
        readJsonBody(c),
        workExists(workId),
    ]);
    if (!exists) {
        return jsonError(c, "作品不存在", 404);
    }

    const content = readTrimmed(body, "content");
    if (!content) {
        return jsonError(c, "评论内容不能为空", 400);
    }
    if (content.length > COMMENT_MAX_LENGTH) {
        return jsonError(c, `评论最多 ${COMMENT_MAX_LENGTH} 字`, 400);
    }

    const parentId = readParentId(body);
    let replyTarget: { userId: string } | null = null;
    if (parentId) {
        const target = await resolveReplyTarget(workId, parentId);
        if (!target.ok) {
            return jsonError(c, target.error, 400);
        }
        replyTarget = target;
    }

    const userId = c.get("userId");
    const inserted = await insertComment({
        workId,
        userId,
        parentId,
        content,
    });
    await insertActivity({
        userId,
        type: "comment",
        actorId: userId,
        workId,
        commentId: inserted.id,
    });

    if (replyTarget && replyTarget.userId !== userId) {
        await insertNotification({
            userId: replyTarget.userId,
            type: "comment",
            actorId: userId,
            workId,
            commentId: inserted.id,
        });
        await publishNewNotification(replyTarget.userId);
    }

    return c.json(
        {
            id: inserted.id,
            content,
            parentId,
            createdAt: inserted.createdAt,
            author: { id: userId, name: c.get("userName") },
        },
        201,
    );
});

function readParentId(body: JsonBody): string | null {
    return readString(body, "parentId") || null;
}

async function resolveReplyTarget(
    workId: string,
    parentId: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
    const parent = await findComment(parentId);
    if (!parent || parent.workId !== workId) {
        return { ok: false, error: "父评论不存在" };
    }
    return { ok: true, userId: parent.userId };
}
