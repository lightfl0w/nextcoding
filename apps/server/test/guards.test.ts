import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { type AuthenticatedEnv, requireSession } from "../src/http/guards.js";
import { requireWorkAuthor } from "../src/works/guards.js";
import * as workRepo from "../src/works/repository.js";
import { makeSession } from "./helpers";
import { mockGetSession } from "./setup";

describe("requireSession", () => {
    function buildApp() {
        const app = new Hono<AuthenticatedEnv>();
        app.use("/protected", requireSession);
        app.get("/protected", (c) =>
            c.json({ userId: c.get("userId"), userName: c.get("userName") }),
        );
        return app;
    }

    it("未登录返回 401", async () => {
        mockGetSession.mockResolvedValue(null);
        const res = await buildApp().request("/protected");
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: "未登录" });
    });

    it("已登录时注入 userId 与 userName", async () => {
        mockGetSession.mockResolvedValue(
            makeSession({ id: "u1", name: "张三" }),
        );
        const res = await buildApp().request("/protected");
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ userId: "u1", userName: "张三" });
    });

    it("登录用户无昵称时注入 null", async () => {
        mockGetSession.mockResolvedValue(makeSession({ id: "u1" }));
        const res = await buildApp().request("/protected");
        expect(await res.json()).toEqual({ userId: "u1", userName: null });
    });
});

describe("requireWorkAuthor", () => {
    function buildApp() {
        const app = new Hono<AuthenticatedEnv>();
        app.use("/w/:id/*", requireWorkAuthor);
        app.get("/w/:id/edit", (c) =>
            c.json({
                ok: true,
                userId: c.get("userId"),
                workId: c.req.param("id"),
            }),
        );
        return app;
    }

    it("未登录返回 401", async () => {
        mockGetSession.mockResolvedValue(null);
        vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("user-1");
        const res = await buildApp().request("/w/work-1/edit");
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: "未登录" });
    });

    it("作品不存在返回 404", async () => {
        vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue(null);
        const res = await buildApp().request("/w/work-1/edit");
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "作品不存在" });
    });

    it("作者不符返回 403", async () => {
        mockGetSession.mockResolvedValue(makeSession({ id: "user-a" }));
        vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("user-b");
        const res = await buildApp().request("/w/work-1/edit");
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: "无权操作" });
    });

    it("作者本人放行并注入用户信息", async () => {
        mockGetSession.mockResolvedValue(
            makeSession({ id: "user-a", name: "张三" }),
        );
        vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("user-a");
        const res = await buildApp().request("/w/work-1/edit");
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            ok: true,
            userId: "user-a",
            workId: "work-1",
        });
    });

    it("携带作品 id 查询作者", async () => {
        mockGetSession.mockResolvedValue(makeSession({ id: "user-a" }));
        vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("user-a");
        await buildApp().request("/w/work-42/edit");
        expect(workRepo.findWorkOwnerId).toHaveBeenCalledWith("work-42");
    });
});
