import { Hono } from "hono";
import { jsonError, readJsonBody, readTrimmed } from "../http/responses.js";
import { type AdminEnv, requireAdmin } from "./guard.js";
import {
    banUser,
    clampPage,
    clampPageSize,
    deleteComment,
    deleteTag,
    deleteUser,
    deleteWork,
    findAdminCommentById,
    findAdminTagById,
    findAdminUserById,
    findAdminWorkById,
    getDashboardStats,
    listAdminTags,
    listComments,
    listUsers,
    listWorks,
    setUserRole,
    unbanUser,
} from "./repository.js";

const USER_ROLES = new Set(["admin", "user"]);
const BAN_REASON_MAX_LENGTH = 200;
const BAN_MAX_HOURS = 24 * 365;

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
