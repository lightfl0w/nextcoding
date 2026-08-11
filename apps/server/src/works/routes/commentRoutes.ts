import { Hono } from "hono";
import {
    type JsonBody,
    jsonError,
    readJsonBody,
    readString,
    readTrimmed,
} from "../../http/responses.js";
import { type AuthenticatedEnv, requireSession } from "../guards.js";
import { COMMENT_MAX_LENGTH, COMMENT_PAGE_SIZE } from "../limits.js";
import {
    findComment,
    insertComment,
    listComments,
    workExists,
} from "../repository.js";
import { toComment } from "../serializers.js";

export const commentRoutes = new Hono<AuthenticatedEnv>();

commentRoutes.get("/:id/comments", async (c) => {
    const rows = await listComments(c.req.param("id"), COMMENT_PAGE_SIZE);
    return c.json(rows.map(toComment));
});

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
    if (parentId) {
        const rejection = await validateParent(workId, parentId);
        if (rejection) {
            return jsonError(c, rejection, 400);
        }
    }

    const userId = c.get("userId");
    const inserted = await insertComment({
        workId,
        userId,
        parentId,
        content,
    });

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

async function validateParent(
    workId: string,
    parentId: string,
): Promise<string | null> {
    const parent = await findComment(parentId);
    if (!parent || parent.workId !== workId) {
        return "父评论不存在";
    }
    if (parent.parentId) {
        return "只能回复一级评论";
    }
    return null;
}
