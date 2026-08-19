import { type Context, Hono } from "hono";
import { jsonError, readJsonBody, readTrimmed } from "../http/responses.js";
import {
    deleteTemplateById,
    findTemplate,
    listAdminTemplates,
    setTemplateReviewStatus,
    type TemplateStatus,
} from "../templates/repository.js";
import { type AdminEnv, requireAdmin } from "./guard.js";
import {
    banUser,
    clampPage,
    clampPageSize,
    countAdminMessages,
    deleteAdminConversation,
    deleteAdminMessage,
    deleteComment,
    deleteTag,
    deleteUser,
    deleteWork,
    findAchievementById,
    findAdminCommentById,
    findAdminConversationById,
    findAdminMessageById,
    findAdminReportById,
    findAdminTagById,
    findAdminUserById,
    findAdminWorkById,
    getDashboardStats,
    grantAchievement,
    handleReport,
    listAdminAchievements,
    listAdminConversations,
    listAdminMessages,
    listAdminReports,
    listAdminTags,
    listAdminUserAchievements,
    listComments,
    listUsers,
    listWorks,
    revokeAchievement,
    setUserRole,
    unbanUser,
} from "./repository.js";

const USER_ROLES = new Set(["admin", "user"]);
const BAN_REASON_MAX_LENGTH = 200;
const BAN_MAX_HOURS = 24 * 365;
const MESSAGE_LIMIT_DEFAULT = 200;
const MESSAGE_LIMIT_MAX = 500;

function clampMessageLimit(raw: string | undefined): number {
    const requested = Number(raw);
    if (!Number.isFinite(requested) || requested <= 0) {
        return MESSAGE_LIMIT_DEFAULT;
    }
    return Math.min(Math.floor(requested), MESSAGE_LIMIT_MAX);
}

export const adminRoutes = new Hono<AdminEnv>().use("*", requireAdmin);

adminRoutes.get("/stats", async (c) => {
    return c.json(await getDashboardStats());
});

adminRoutes.get("/users", async (c) => {
    const search =
        (c.req.query("search") ?? "").trim().slice(0, 64) || undefined;
    const rawRole = c.req.query("role");
    const rawBanned = c.req.query("banned");
    const result = await listUsers({
        search,
        role: rawRole === "admin" || rawRole === "user" ? rawRole : undefined,
        banned:
            rawBanned === "true"
                ? true
                : rawBanned === "false"
                  ? false
                  : undefined,
        page: clampPage(c.req.query("page")),
        pageSize: clampPageSize(c.req.query("pageSize")),
    });
    return c.json(result);
});

adminRoutes.patch("/users/:id/role", async (c) => {
    const targetId = c.req.param("id");
    if (targetId === c.get("adminId")) {
        return jsonError(c, "不能修改自己的角色", 400);
    }
    if (!(await findAdminUserById(targetId))) {
        return jsonError(c, "用户不存在", 404);
    }

    const body = await readJsonBody(c);
    const role = readTrimmed(body, "role");
    if (!USER_ROLES.has(role)) {
        return jsonError(c, "不支持的角色", 400);
    }

    await setUserRole(targetId, role as "admin" | "user");
    return c.json({ id: targetId, role });
});

adminRoutes.post("/users/:id/ban", async (c) => {
    const targetId = c.req.param("id");
    if (targetId === c.get("adminId")) {
        return jsonError(c, "不能封禁自己", 400);
    }
    const target = await findAdminUserById(targetId);
    if (!target) {
        return jsonError(c, "用户不存在", 404);
    }

    const body = await readJsonBody(c);
    const reason = readTrimmed(body, "reason").slice(0, BAN_REASON_MAX_LENGTH);
    const rawHours = body.hours;
    const hours =
        typeof rawHours === "number" &&
        Number.isFinite(rawHours) &&
        rawHours > 0
            ? Math.min(rawHours, BAN_MAX_HOURS)
            : null;
    const expiresAt =
        hours === null ? null : new Date(Date.now() + hours * 60 * 60 * 1000);

    await banUser(targetId, reason || null, expiresAt);
    return c.json({
        id: targetId,
        banned: true,
        banReason: reason || null,
        banExpires: expiresAt,
    });
});

adminRoutes.delete("/users/:id/ban", async (c) => {
    const targetId = c.req.param("id");
    if (!(await findAdminUserById(targetId))) {
        return jsonError(c, "用户不存在", 404);
    }
    await unbanUser(targetId);
    return c.json({ id: targetId, banned: false });
});

adminRoutes.delete("/users/:id", async (c) => {
    const targetId = c.req.param("id");
    if (targetId === c.get("adminId")) {
        return jsonError(c, "不能删除自己", 400);
    }
    if (!(await findAdminUserById(targetId))) {
        return jsonError(c, "用户不存在", 404);
    }
    await deleteUser(targetId);
    return c.json({ ok: true, id: targetId });
});

adminRoutes.get("/works", async (c) => {
    const search =
        (c.req.query("search") ?? "").trim().slice(0, 64) || undefined;
    const rawStatus = c.req.query("status");
    const result = await listWorks({
        search,
        status:
            rawStatus === "draft" || rawStatus === "published"
                ? rawStatus
                : undefined,
        page: clampPage(c.req.query("page")),
        pageSize: clampPageSize(c.req.query("pageSize")),
    });
    return c.json(result);
});

adminRoutes.delete("/works/:id", async (c) => {
    const workId = c.req.param("id");
    if (!(await findAdminWorkById(workId))) {
        return jsonError(c, "作品不存在", 404);
    }
    await deleteWork(workId);
    return c.json({ ok: true, id: workId });
});

adminRoutes.get("/comments", async (c) => {
    const search =
        (c.req.query("search") ?? "").trim().slice(0, 64) || undefined;
    const result = await listComments({
        search,
        page: clampPage(c.req.query("page")),
        pageSize: clampPageSize(c.req.query("pageSize")),
    });
    return c.json(result);
});

adminRoutes.delete("/comments/:id", async (c) => {
    const commentId = c.req.param("id");
    if (!(await findAdminCommentById(commentId))) {
        return jsonError(c, "评论不存在", 404);
    }
    await deleteComment(commentId);
    return c.json({ ok: true, id: commentId });
});

adminRoutes.get("/tags", async (c) => {
    const result = await listAdminTags();
    return c.json(result);
});

adminRoutes.delete("/tags/:id", async (c) => {
    const tagId = c.req.param("id");
    if (!(await findAdminTagById(tagId))) {
        return jsonError(c, "标签不存在", 404);
    }
    await deleteTag(tagId);
    return c.json({ ok: true, id: tagId });
});

adminRoutes.get("/conversations", async (c) => {
    const search =
        (c.req.query("search") ?? "").trim().slice(0, 64) || undefined;
    const result = await listAdminConversations({
        search,
        page: clampPage(c.req.query("page")),
        pageSize: clampPageSize(c.req.query("pageSize")),
    });
    return c.json({
        total: result.total,
        items: result.items.map(toAdminConversation),
    });
});

adminRoutes.get("/conversations/:id/messages", async (c) => {
    const conversationId = c.req.param("id");
    if (!(await findAdminConversationById(conversationId))) {
        return jsonError(c, "会话不存在", 404);
    }
    const limit = clampMessageLimit(c.req.query("limit"));
    const rawOffset = Number(c.req.query("offset"));
    const offset =
        Number.isFinite(rawOffset) && rawOffset >= 0
            ? Math.floor(rawOffset)
            : 0;

    const [rows, total] = await Promise.all([
        listAdminMessages(conversationId, limit, offset),
        countAdminMessages(conversationId),
    ]);
    return c.json({ total, items: rows.map(toAdminMessage) });
});

adminRoutes.delete("/messages/:id", async (c) => {
    const messageId = c.req.param("id");
    if (!(await findAdminMessageById(messageId))) {
        return jsonError(c, "消息不存在", 404);
    }
    await deleteAdminMessage(messageId);
    return c.json({ ok: true, id: messageId });
});

adminRoutes.delete("/conversations/:id", async (c) => {
    const conversationId = c.req.param("id");
    if (!(await findAdminConversationById(conversationId))) {
        return jsonError(c, "会话不存在", 404);
    }
    await deleteAdminConversation(conversationId);
    return c.json({ ok: true, id: conversationId });
});

adminRoutes.get("/reports", async (c) => {
    const rawStatus = c.req.query("status");
    const status =
        rawStatus === "pending" ||
        rawStatus === "resolved" ||
        rawStatus === "dismissed"
            ? rawStatus
            : undefined;
    const result = await listAdminReports({
        status,
        page: clampPage(c.req.query("page")),
        pageSize: clampPageSize(c.req.query("pageSize")),
    });
    return c.json(result);
});

async function handleReportAction(
    c: Context<AdminEnv>,
    status: "resolved" | "dismissed",
) {
    const reportId = c.req.param("id") ?? "";
    if (!(await findAdminReportById(reportId))) {
        return jsonError(c, "举报不存在", 404);
    }
    await handleReport(reportId, status, c.get("adminId"));
    return c.json({ ok: true, id: reportId, status });
}

adminRoutes.post("/reports/:id/resolve", async (c) => {
    return handleReportAction(c, "resolved");
});

adminRoutes.post("/reports/:id/dismiss", async (c) => {
    return handleReportAction(c, "dismissed");
});

const TEMPLATE_STATUSES = new Set<TemplateStatus>([
    "pending",
    "published",
    "rejected",
]);

adminRoutes.get("/templates", async (c) => {
    const search =
        (c.req.query("search") ?? "").trim().slice(0, 64) || undefined;
    const rawStatus = c.req.query("status");
    const status = TEMPLATE_STATUSES.has(rawStatus as TemplateStatus)
        ? (rawStatus as TemplateStatus)
        : undefined;
    const result = await listAdminTemplates({
        search,
        status,
        page: clampPage(c.req.query("page")),
        pageSize: clampPageSize(c.req.query("pageSize")),
    });
    return c.json(result);
});

async function handleTemplateReview(
    c: Context<AdminEnv>,
    status: TemplateStatus,
) {
    const templateId = c.req.param("id") ?? "";
    if (!(await findTemplate(templateId))) {
        return jsonError(c, "模板不存在", 404);
    }
    await setTemplateReviewStatus(templateId, status, c.get("adminId"));
    return c.json({ ok: true, id: templateId, status });
}

adminRoutes.post("/templates/:id/approve", async (c) => {
    return handleTemplateReview(c, "published");
});

adminRoutes.post("/templates/:id/reject", async (c) => {
    return handleTemplateReview(c, "rejected");
});

adminRoutes.delete("/templates/:id", async (c) => {
    const templateId = c.req.param("id");
    if (!(await findTemplate(templateId))) {
        return jsonError(c, "模板不存在", 404);
    }
    await deleteTemplateById(templateId);
    return c.json({ ok: true, id: templateId });
});

adminRoutes.get("/achievements", async (c) => {
    return c.json(await listAdminAchievements());
});

adminRoutes.get("/achievements/users/:id", async (c) => {
    const userId = c.req.param("id") ?? "";
    if (!(await findAdminUserById(userId))) {
        return jsonError(c, "用户不存在", 404);
    }
    return c.json(await listAdminUserAchievements(userId));
});

adminRoutes.post("/achievements/grant", async (c) => {
    const body = await readJsonBody(c);
    const userId = readTrimmed(body, "userId");
    const achievementId = readTrimmed(body, "achievementId");
    if (!userId || !achievementId) {
        return jsonError(c, "参数不完整", 400);
    }
    if (!(await findAdminUserById(userId))) {
        return jsonError(c, "用户不存在", 404);
    }
    if (!(await findAchievementById(achievementId))) {
        return jsonError(c, "成就不存在", 404);
    }
    const result = await grantAchievement(userId, achievementId);
    return c.json({ ok: true, ...result });
});

adminRoutes.post("/achievements/revoke", async (c) => {
    const body = await readJsonBody(c);
    const userId = readTrimmed(body, "userId");
    const achievementId = readTrimmed(body, "achievementId");
    if (!userId || !achievementId) {
        return jsonError(c, "参数不完整", 400);
    }
    await revokeAchievement(userId, achievementId);
    return c.json({ ok: true });
});

interface AdminConversationRow {
    id: string;
    user1Id: string;
    user1Name: string | null;
    user1Image: string | null;
    user1Email: string | null;
    user2Id: string;
    user2Name: string | null;
    user2Image: string | null;
    user2Email: string | null;
    lastMessageAt: Date | null;
    createdAt: Date;
    messageCount: number;
    lastMessage: string | null;
}

function toAdminConversation(row: AdminConversationRow) {
    return {
        id: row.id,
        user1: {
            id: row.user1Id,
            name: row.user1Name,
            image: row.user1Image,
            email: row.user1Email,
        },
        user2: {
            id: row.user2Id,
            name: row.user2Name,
            image: row.user2Image,
            email: row.user2Email,
        },
        messageCount: row.messageCount,
        lastMessage: row.lastMessage,
        lastMessageAt: row.lastMessageAt,
        createdAt: row.createdAt,
    };
}

interface AdminMessageRow {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    read: boolean;
    createdAt: Date;
    senderName: string | null;
    senderImage: string | null;
}

function toAdminMessage(row: AdminMessageRow) {
    return {
        id: row.id,
        conversationId: row.conversationId,
        senderId: row.senderId,
        content: row.content,
        read: row.read,
        createdAt: row.createdAt,
        sender: {
            id: row.senderId,
            name: row.senderName,
            image: row.senderImage,
        },
    };
}
