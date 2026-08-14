import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as adminRepo from "../src/admin/repository.js";
import { adminRoutes } from "../src/admin/routes.js";
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
