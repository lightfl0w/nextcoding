import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as adminRepo from "../src/admin/repository.js";
import { adminRoutes } from "../src/admin/routes.js";
import * as templateRepo from "../src/templates/repository.js";
import { mockGetSession } from "./setup";

function adminSession(userId = "admin-1") {
    return {
        user: { id: userId, name: "管理员", role: "admin" },
        session: { id: "sess-admin" },
    };
}

function app() {
    return new Hono().route("/api/admin", adminRoutes);
}

describe("requireAdmin", () => {
    it("未登录返回 401", async () => {
        mockGetSession.mockResolvedValue(null);
        const res = await app().request("/api/admin/stats");
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: "未登录" });
    });

    it("非管理员返回 403", async () => {
        mockGetSession.mockResolvedValue({
            user: { id: "user-1", name: "张三", role: "user" },
            session: { id: "sess-1" },
        });
        const res = await app().request("/api/admin/stats");
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: "需要管理员权限" });
    });

    it("管理员放行", async () => {
        mockGetSession.mockResolvedValue(adminSession());
        vi.mocked(adminRepo.getDashboardStats).mockResolvedValue({} as never);
        const res = await app().request("/api/admin/stats");
        expect(res.status).toBe(200);
    });
});

describe("GET /stats", () => {
    it("返回仪表盘统计", async () => {
        mockGetSession.mockResolvedValue(adminSession());
        const stats = {
            users: 10,
            works: 20,
            publishedWorks: 15,
            comments: 30,
            tags: 5,
            sparks: 100,
            views: 2000,
            trend: [],
            recentUsers: [],
            topWorks: [],
        };
        vi.mocked(adminRepo.getDashboardStats).mockResolvedValue(stats);
        const res = await app().request("/api/admin/stats");
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual(stats);
    });
});

describe("GET /users", () => {
    it("透传筛选与分页参数", async () => {
        mockGetSession.mockResolvedValue(adminSession());
        vi.mocked(adminRepo.listUsers).mockResolvedValue({
            total: 0,
            items: [],
        });
        await app().request(
            "/api/admin/users?search=abc&role=admin&banned=true&page=2&pageSize=30",
        );
        expect(adminRepo.listUsers).toHaveBeenCalledWith({
            search: "abc",
            role: "admin",
            banned: true,
            page: 2,
            pageSize: 30,
        });
    });

    it("忽略非法的角色与封禁参数", async () => {
        mockGetSession.mockResolvedValue(adminSession());
        vi.mocked(adminRepo.listUsers).mockResolvedValue({
            total: 0,
            items: [],
        });
        await app().request("/api/admin/users?role=super&banned=maybe");
        expect(adminRepo.listUsers).toHaveBeenCalledWith({
            search: undefined,
            role: undefined,
            banned: undefined,
            page: 1,
            pageSize: 20,
        });
    });

    it("返回用户列表与总数", async () => {
        mockGetSession.mockResolvedValue(adminSession());
        const payload = { total: 1, items: [{ id: "u1", name: "张三" }] };
        vi.mocked(adminRepo.listUsers).mockResolvedValue(payload as never);
        const res = await app().request("/api/admin/users");
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual(payload);
    });
});

describe("PATCH /users/:id/role", () => {
    it("不能修改自己的角色", async () => {
        mockGetSession.mockResolvedValue(adminSession("admin-1"));
        const res = await app().request("/api/admin/users/admin-1/role", {
            method: "PATCH",
            body: JSON.stringify({ role: "user" }),
            headers: { "content-type": "application/json" },
        });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "不能修改自己的角色" });
    });

    it("用户不存在返回 404", async () => {
        mockGetSession.mockResolvedValue(adminSession());
        vi.mocked(adminRepo.findAdminUserById).mockResolvedValue(undefined);
        const res = await app().request("/api/admin/users/u-missing/role", {
            method: "PATCH",
            body: JSON.stringify({ role: "admin" }),
            headers: { "content-type": "application/json" },
        });
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "用户不存在" });
    });

    it("非法的角色返回 400", async () => {
        mockGetSession.mockResolvedValue(adminSession());
        vi.mocked(adminRepo.findAdminUserById).mockResolvedValue({
            id: "u1",
        } as never);
        const res = await app().request("/api/admin/users/u1/role", {
            method: "PATCH",
            body: JSON.stringify({ role: "moderator" }),
            headers: { "content-type": "application/json" },
        });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "不支持的角色" });
    });

    it("成功修改角色", async () => {
        mockGetSession.mockResolvedValue(adminSession());
        vi.mocked(adminRepo.findAdminUserById).mockResolvedValue({
            id: "u1",
        } as never);
        const res = await app().request("/api/admin/users/u1/role", {
            method: "PATCH",
            body: JSON.stringify({ role: "admin" }),
            headers: { "content-type": "application/json" },
        });
        expect(res.status).toBe(200);
        expect(adminRepo.setUserRole).toHaveBeenCalledWith("u1", "admin");
        expect(await res.json()).toEqual({ id: "u1", role: "admin" });
    });
});

describe("POST /users/:id/ban", () => {
    it("不能封禁自己", async () => {
        mockGetSession.mockResolvedValue(adminSession("admin-1"));
        const res = await app().request("/api/admin/users/admin-1/ban", {
            method: "POST",
        });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "不能封禁自己" });
    });

    it("带原因与时长封禁", async () => {
        mockGetSession.mockResolvedValue(adminSession());
        vi.mocked(adminRepo.findAdminUserById).mockResolvedValue({
            id: "u1",
        } as never);
        const res = await app().request("/api/admin/users/u1/ban", {
            method: "POST",
            body: JSON.stringify({ reason: "违规", hours: 24 }),
            headers: { "content-type": "application/json" },
        });
        expect(res.status).toBe(200);
        expect(adminRepo.banUser).toHaveBeenCalledWith(
            "u1",
            "违规",
            expect.any(Date),
        );
        const body = (await res.json()) as {
            banned: boolean;
            banExpires: unknown;
        };
        expect(body.banned).toBe(true);
        expect(typeof body.banExpires).toBe("string");
    });

    it("未填时长时封禁不设过期", async () => {
        mockGetSession.mockResolvedValue(adminSession());
        vi.mocked(adminRepo.findAdminUserById).mockResolvedValue({
            id: "u1",
        } as never);
        const res = await app().request("/api/admin/users/u1/ban", {
            method: "POST",
            body: JSON.stringify({ reason: "违规" }),
            headers: { "content-type": "application/json" },
        });
        expect(res.status).toBe(200);
        expect(adminRepo.banUser).toHaveBeenCalledWith("u1", "违规", null);
    });
});

describe("DELETE /users/:id/ban", () => {
    it("解封用户", async () => {
        mockGetSession.mockResolvedValue(adminSession());
        vi.mocked(adminRepo.findAdminUserById).mockResolvedValue({
            id: "u1",
        } as never);
        const res = await app().request("/api/admin/users/u1/ban", {
            method: "DELETE",
        });
        expect(res.status).toBe(200);
        expect(adminRepo.unbanUser).toHaveBeenCalledWith("u1");
        expect(await res.json()).toEqual({ id: "u1", banned: false });
    });

    it("用户不存在返回 404", async () => {
        mockGetSession.mockResolvedValue(adminSession());
        vi.mocked(adminRepo.findAdminUserById).mockResolvedValue(undefined);
        const res = await app().request("/api/admin/users/u-missing/ban", {
            method: "DELETE",
        });
        expect(res.status).toBe(404);
    });
});

describe("DELETE /users/:id", () => {
    it("不能删除自己", async () => {
        mockGetSession.mockResolvedValue(adminSession("admin-1"));
        const res = await app().request("/api/admin/users/admin-1", {
            method: "DELETE",
        });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "不能删除自己" });
    });

    it("用户不存在返回 404", async () => {
        mockGetSession.mockResolvedValue(adminSession());
        vi.mocked(adminRepo.findAdminUserById).mockResolvedValue(undefined);
        const res = await app().request("/api/admin/users/u-missing", {
            method: "DELETE",
        });
        expect(res.status).toBe(404);
    });

    it("成功删除用户", async () => {
        mockGetSession.mockResolvedValue(adminSession());
        vi.mocked(adminRepo.findAdminUserById).mockResolvedValue({
            id: "u1",
        } as never);
        const res = await app().request("/api/admin/users/u1", {
            method: "DELETE",
        });
        expect(res.status).toBe(200);
        expect(adminRepo.deleteUser).toHaveBeenCalledWith("u1");
    });
});

describe("作品/评论/标签管理", () => {
    beforeEach(() => {
        mockGetSession.mockResolvedValue(adminSession());
    });

    it("GET /works 透传筛选与分页参数", async () => {
        vi.mocked(adminRepo.listWorks).mockResolvedValue({
            total: 0,
            items: [],
        });
        await app().request(
            "/api/admin/works?search=demo&status=published&page=2&pageSize=10",
        );
        expect(adminRepo.listWorks).toHaveBeenCalledWith({
            search: "demo",
            status: "published",
            page: 2,
            pageSize: 10,
        });
    });

    it("GET /comments 透传搜索参数", async () => {
        vi.mocked(adminRepo.listComments).mockResolvedValue({
            total: 0,
            items: [],
        });
        await app().request("/api/admin/comments?search=好棒");
        expect(adminRepo.listComments).toHaveBeenCalledWith({
            search: "好棒",
            page: 1,
            pageSize: 20,
        });
    });

    it("GET /tags 返回标签列表", async () => {
        vi.mocked(adminRepo.listAdminTags).mockResolvedValue([]);
        const res = await app().request("/api/admin/tags");
        expect(res.status).toBe(200);
        expect(adminRepo.listAdminTags).toHaveBeenCalledTimes(1);
    });

    it("DELETE /works/:id 作品不存在返回 404", async () => {
        vi.mocked(adminRepo.findAdminWorkById).mockResolvedValue(undefined);
        const res = await app().request("/api/admin/works/w-missing", {
            method: "DELETE",
        });
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "作品不存在" });
    });

    it("DELETE /works/:id 成功删除", async () => {
        vi.mocked(adminRepo.findAdminWorkById).mockResolvedValue({
            id: "w1",
        } as never);
        const res = await app().request("/api/admin/works/w1", {
            method: "DELETE",
        });
        expect(res.status).toBe(200);
        expect(adminRepo.deleteWork).toHaveBeenCalledWith("w1");
    });

    it("DELETE /comments/:id 成功删除", async () => {
        vi.mocked(adminRepo.findAdminCommentById).mockResolvedValue({
            id: "c1",
        } as never);
        const res = await app().request("/api/admin/comments/c1", {
            method: "DELETE",
        });
        expect(res.status).toBe(200);
        expect(adminRepo.deleteComment).toHaveBeenCalledWith("c1");
    });

    it("DELETE /tags/:id 成功删除", async () => {
        vi.mocked(adminRepo.findAdminTagById).mockResolvedValue({
            id: "t1",
        } as never);
        const res = await app().request("/api/admin/tags/t1", {
            method: "DELETE",
        });
        expect(res.status).toBe(200);
        expect(adminRepo.deleteTag).toHaveBeenCalledWith("t1");
    });
});

describe("会话/消息管理", () => {
    beforeEach(() => {
        mockGetSession.mockResolvedValue(adminSession());
    });

    function conversationRow(overrides: Record<string, unknown> = {}) {
        return {
            id: "conv-1",
            user1Id: "u1",
            user1Name: "张三",
            user1Image: null,
            user1Email: "a@b.c",
            user2Id: "u2",
            user2Name: "李四",
            user2Image: null,
            user2Email: "d@e.f",
            messageCount: 3,
            lastMessage: "你好",
            lastMessageAt: new Date("2026-01-01T00:00:00Z"),
            createdAt: new Date("2026-01-01T00:00:00Z"),
            ...overrides,
        };
    }

    it("GET /conversations 透传搜索与分页参数", async () => {
        vi.mocked(adminRepo.listAdminConversations).mockResolvedValue({
            total: 0,
            items: [],
        });
        const res = await app().request(
            "/api/admin/conversations?search=张三&page=2&pageSize=10",
        );
        expect(res.status).toBe(200);
        expect(adminRepo.listAdminConversations).toHaveBeenCalledWith({
            search: "张三",
            page: 2,
            pageSize: 10,
        });
        expect(await res.json()).toEqual({ total: 0, items: [] });
    });

    it("GET /conversations 序列化双方用户信息", async () => {
        vi.mocked(adminRepo.listAdminConversations).mockResolvedValue({
            total: 1,
            items: [conversationRow()],
        } as never);
        const res = await app().request("/api/admin/conversations");
        const body = (await res.json()) as {
            items: Array<{ user1: { name: string }; user2: { name: string } }>;
        };
        expect(body.items[0].user1.name).toBe("张三");
        expect(body.items[0].user2.name).toBe("李四");
    });

    it("GET /conversations/:id/messages 会话不存在返回 404", async () => {
        vi.mocked(adminRepo.findAdminConversationById).mockResolvedValue(
            undefined,
        );
        const res = await app().request(
            "/api/admin/conversations/conv-missing/messages",
        );
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "会话不存在" });
    });

    it("GET /conversations/:id/messages 返回消息列表与总数", async () => {
        vi.mocked(adminRepo.findAdminConversationById).mockResolvedValue({
            id: "conv-1",
        } as never);
        vi.mocked(adminRepo.countAdminMessages).mockResolvedValue(2);
        vi.mocked(adminRepo.listAdminMessages).mockResolvedValue([
            {
                id: "m1",
                conversationId: "conv-1",
                senderId: "u1",
                content: "你好",
                read: true,
                createdAt: new Date("2026-01-01T00:00:00Z"),
                senderName: "张三",
                senderImage: null,
            },
        ] as never);
        const res = await app().request(
            "/api/admin/conversations/conv-1/messages",
        );
        expect(res.status).toBe(200);
        const body = (await res.json()) as { total: number; items: unknown[] };
        expect(body.total).toBe(2);
        expect(body.items[0]).toMatchObject({
            id: "m1",
            content: "你好",
            sender: { id: "u1", name: "张三" },
        });
    });

    it("DELETE /messages/:id 消息不存在返回 404", async () => {
        vi.mocked(adminRepo.findAdminMessageById).mockResolvedValue(undefined);
        const res = await app().request("/api/admin/messages/m-missing", {
            method: "DELETE",
        });
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "消息不存在" });
    });

    it("DELETE /messages/:id 成功删除消息", async () => {
        vi.mocked(adminRepo.findAdminMessageById).mockResolvedValue({
            id: "m1",
        } as never);
        const res = await app().request("/api/admin/messages/m1", {
            method: "DELETE",
        });
        expect(res.status).toBe(200);
        expect(adminRepo.deleteAdminMessage).toHaveBeenCalledWith("m1");
    });

    it("DELETE /conversations/:id 成功删除会话", async () => {
        vi.mocked(adminRepo.findAdminConversationById).mockResolvedValue({
            id: "conv-1",
        } as never);
        const res = await app().request("/api/admin/conversations/conv-1", {
            method: "DELETE",
        });
        expect(res.status).toBe(200);
        expect(adminRepo.deleteAdminConversation).toHaveBeenCalledWith(
            "conv-1",
        );
    });
});

describe("举报管理", () => {
    beforeEach(() => {
        mockGetSession.mockResolvedValue(adminSession());
    });

    it("GET /reports 透传状态与分页参数", async () => {
        vi.mocked(adminRepo.listAdminReports).mockResolvedValue({
            total: 0,
            items: [],
        });
        const res = await app().request(
            "/api/admin/reports?status=pending&page=2&pageSize=10",
        );
        expect(res.status).toBe(200);
        expect(adminRepo.listAdminReports).toHaveBeenCalledWith({
            status: "pending",
            page: 2,
            pageSize: 10,
        });
    });

    it("GET /reports 忽略非法状态参数", async () => {
        vi.mocked(adminRepo.listAdminReports).mockResolvedValue({
            total: 0,
            items: [],
        });
        await app().request("/api/admin/reports?status=unknown");
        expect(adminRepo.listAdminReports).toHaveBeenCalledWith({
            status: undefined,
            page: 1,
            pageSize: 20,
        });
    });

    it("POST /reports/:id/resolve 举报不存在返回 404", async () => {
        vi.mocked(adminRepo.findAdminReportById).mockResolvedValue(undefined);
        const res = await app().request(
            "/api/admin/reports/r-missing/resolve",
            {
                method: "POST",
            },
        );
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "举报不存在" });
    });

    it("POST /reports/:id/resolve 处理举报", async () => {
        vi.mocked(adminRepo.findAdminReportById).mockResolvedValue({
            id: "r1",
        } as never);
        const res = await app().request("/api/admin/reports/r1/resolve", {
            method: "POST",
        });
        expect(res.status).toBe(200);
        expect(adminRepo.handleReport).toHaveBeenCalledWith(
            "r1",
            "resolved",
            "admin-1",
        );
        expect(await res.json()).toEqual({
            ok: true,
            id: "r1",
            status: "resolved",
        });
    });

    it("POST /reports/:id/dismiss 忽略举报", async () => {
        vi.mocked(adminRepo.findAdminReportById).mockResolvedValue({
            id: "r1",
        } as never);
        const res = await app().request("/api/admin/reports/r1/dismiss", {
            method: "POST",
        });
        expect(res.status).toBe(200);
        expect(adminRepo.handleReport).toHaveBeenCalledWith(
            "r1",
            "dismissed",
            "admin-1",
        );
    });
});

describe("成就管理", () => {
    beforeEach(() => {
        mockGetSession.mockResolvedValue(adminSession());
    });

    it("GET /achievements 返回成就目录", async () => {
        vi.mocked(adminRepo.listAdminAchievements).mockResolvedValue([
            { id: "a1", name: "首次发布", unlockCount: 5 },
        ] as never);
        const res = await app().request("/api/admin/achievements");
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual([
            { id: "a1", name: "首次发布", unlockCount: 5 },
        ]);
    });

    it("GET /achievements/users/:id 用户不存在返回 404", async () => {
        vi.mocked(adminRepo.findAdminUserById).mockResolvedValue(undefined);
        const res = await app().request("/api/admin/achievements/users/u-x");
        expect(res.status).toBe(404);
    });

    it("GET /achievements/users/:id 返回用户成就", async () => {
        vi.mocked(adminRepo.findAdminUserById).mockResolvedValue({
            id: "u1",
        } as never);
        vi.mocked(adminRepo.listAdminUserAchievements).mockResolvedValue([
            { id: "a1", name: "首次发布" },
        ] as never);
        const res = await app().request("/api/admin/achievements/users/u1");
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual([{ id: "a1", name: "首次发布" }]);
    });

    it("POST /achievements/grant 参数不完整返回 400", async () => {
        const res = await app().request("/api/admin/achievements/grant", {
            method: "POST",
            body: JSON.stringify({ userId: "u1" }),
            headers: { "content-type": "application/json" },
        });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "参数不完整" });
    });

    it("POST /achievements/grant 成就不存在返回 404", async () => {
        vi.mocked(adminRepo.findAdminUserById).mockResolvedValue({
            id: "u1",
        } as never);
        vi.mocked(adminRepo.findAchievementById).mockResolvedValue(undefined);
        const res = await app().request("/api/admin/achievements/grant", {
            method: "POST",
            body: JSON.stringify({ userId: "u1", achievementId: "a-x" }),
            headers: { "content-type": "application/json" },
        });
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "成就不存在" });
    });

    it("POST /achievements/grant 授予成就", async () => {
        vi.mocked(adminRepo.findAdminUserById).mockResolvedValue({
            id: "u1",
        } as never);
        vi.mocked(adminRepo.findAchievementById).mockResolvedValue({
            id: "a1",
        } as never);
        vi.mocked(adminRepo.grantAchievement).mockResolvedValue({
            granted: true,
        });
        const res = await app().request("/api/admin/achievements/grant", {
            method: "POST",
            body: JSON.stringify({ userId: "u1", achievementId: "a1" }),
            headers: { "content-type": "application/json" },
        });
        expect(res.status).toBe(200);
        expect(adminRepo.grantAchievement).toHaveBeenCalledWith("u1", "a1");
        expect(await res.json()).toEqual({ ok: true, granted: true });
    });

    it("POST /achievements/revoke 撤销成就", async () => {
        const res = await app().request("/api/admin/achievements/revoke", {
            method: "POST",
            body: JSON.stringify({ userId: "u1", achievementId: "a1" }),
            headers: { "content-type": "application/json" },
        });
        expect(res.status).toBe(200);
        expect(adminRepo.revokeAchievement).toHaveBeenCalledWith("u1", "a1");
    });
});

describe("模板审核", () => {
    function templateRow(overrides: Record<string, unknown> = {}) {
        return {
            id: "tpl-1",
            title: "Python 小游戏",
            status: "pending",
            fileCount: 2,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            authorId: "user-1",
            authorName: "张三",
            ...overrides,
        };
    }

    it("GET /templates 透传状态与分页参数", async () => {
        mockGetSession.mockResolvedValue(adminSession());
        vi.mocked(templateRepo.listAdminTemplates).mockResolvedValue({
            total: 1,
            items: [templateRow()] as never,
        });
        const res = await app().request(
            "/api/admin/templates?status=pending&page=2&pageSize=30",
        );
        expect(res.status).toBe(200);
        expect(templateRepo.listAdminTemplates).toHaveBeenCalledWith({
            status: "pending",
            page: 2,
            pageSize: 30,
        });
        expect(await res.json()).toEqual({
            total: 1,
            items: [expect.objectContaining({ title: "Python 小游戏" })],
        });
    });

    it("GET /templates 非法状态不传 status", async () => {
        mockGetSession.mockResolvedValue(adminSession());
        vi.mocked(templateRepo.listAdminTemplates).mockResolvedValue({
            total: 0,
            items: [],
        });
        await app().request("/api/admin/templates?status=whatever");
        expect(templateRepo.listAdminTemplates).toHaveBeenCalledWith({
            status: undefined,
            page: 1,
            pageSize: 20,
        });
    });

    it("POST /templates/:id/approve 模板不存在返回 404", async () => {
        mockGetSession.mockResolvedValue(adminSession());
        vi.mocked(templateRepo.findTemplate).mockResolvedValue(undefined);
        const res = await app().request("/api/admin/templates/tpl-1/approve", {
            method: "POST",
        });
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "模板不存在" });
    });

    it("POST /templates/:id/approve 通过审核", async () => {
        mockGetSession.mockResolvedValue(adminSession());
        vi.mocked(templateRepo.findTemplate).mockResolvedValue(
            templateRow() as never,
        );
        const res = await app().request("/api/admin/templates/tpl-1/approve", {
            method: "POST",
        });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            ok: true,
            id: "tpl-1",
            status: "published",
        });
        expect(templateRepo.setTemplateReviewStatus).toHaveBeenCalledWith(
            "tpl-1",
            "published",
            "admin-1",
        );
    });

    it("POST /templates/:id/reject 驳回审核", async () => {
        mockGetSession.mockResolvedValue(adminSession());
        vi.mocked(templateRepo.findTemplate).mockResolvedValue(
            templateRow() as never,
        );
        const res = await app().request("/api/admin/templates/tpl-1/reject", {
            method: "POST",
        });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            ok: true,
            id: "tpl-1",
            status: "rejected",
        });
        expect(templateRepo.setTemplateReviewStatus).toHaveBeenCalledWith(
            "tpl-1",
            "rejected",
            "admin-1",
        );
    });

    it("DELETE /templates/:id 删除模板", async () => {
        mockGetSession.mockResolvedValue(adminSession());
        vi.mocked(templateRepo.findTemplate).mockResolvedValue(
            templateRow() as never,
        );
        const res = await app().request("/api/admin/templates/tpl-1", {
            method: "DELETE",
        });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true, id: "tpl-1" });
        expect(templateRepo.deleteTemplateById).toHaveBeenCalledWith("tpl-1");
    });

    it("DELETE /templates/:id 模板不存在返回 404", async () => {
        mockGetSession.mockResolvedValue(adminSession());
        vi.mocked(templateRepo.findTemplate).mockResolvedValue(undefined);
        const res = await app().request("/api/admin/templates/tpl-1", {
            method: "DELETE",
        });
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "模板不存在" });
    });
});
