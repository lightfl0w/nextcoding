import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import * as activityRepo from "../src/activities/repository.js";
import * as templateRepo from "../src/templates/repository.js";
import { templateRoutes } from "../src/templates/routes.js";
import * as workRepo from "../src/works/repository.js";
import { mockGetSession, storage } from "./setup";

describe("templateRoutes", () => {
    function app() {
        return new Hono().route("/api/templates", templateRoutes);
    }

    function templateRow(overrides: Record<string, unknown> = {}) {
        return {
            id: "tpl-1",
            title: "空白项目",
            description: "一个空的起点",
            category: "basic",
            tags: "[]",
            coverUrl: null,
            status: "published",
            fileCount: 1,
            useCount: 0,
            snapshotKey: "templates/tpl-1/snapshot.json",
            createdAt: new Date("2026-01-01T00:00:00Z"),
            updatedAt: new Date("2026-01-01T00:00:00Z"),
            authorId: "user-1",
            authorName: "张三",
            authorImage: null,
            derivedCount: 0,
            ...overrides,
        };
    }

    function adminSession() {
        return {
            user: { id: "admin-1", name: "管理员", role: "admin" },
            session: { id: "sess-admin" },
        };
    }

    function storeSnapshot(id: string, files: unknown) {
        storage.store.set(
            `templates/${id}/snapshot.json`,
            new TextEncoder().encode(
                JSON.stringify({ version: 1, createdAt: 1, files }),
            ),
        );
    }

    describe("GET /", () => {
        it("返回模板数组", async () => {
            vi.mocked(templateRepo.listTemplates).mockResolvedValue([
                templateRow(),
            ] as never);
            const res = await app().request("/api/templates");
            expect(res.status).toBe(200);
            const body = (await res.json()) as Array<Record<string, unknown>>;
            expect(Array.isArray(body)).toBe(true);
            expect(body[0]).toMatchObject({
                title: "空白项目",
                status: "published",
            });
        });

        it("支持分类筛选", async () => {
            vi.mocked(templateRepo.listTemplates).mockResolvedValue([]);
            await app().request("/api/templates?category=web");
            expect(templateRepo.listTemplates).toHaveBeenCalledWith(
                "web",
                "hot",
                50,
            );
        });
    });

    describe("GET /:id", () => {
        it("模板不存在返回 404", async () => {
            vi.mocked(templateRepo.findTemplateDetail).mockResolvedValue(
                undefined,
            );
            const res = await app().request("/api/templates/nope");
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "模板不存在" });
        });

        it("已上架模板公开可见", async () => {
            vi.mocked(templateRepo.findTemplateDetail).mockResolvedValue(
                templateRow({ authorId: "other-user" }),
            );
            const res = await app().request("/api/templates/tpl-1");
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body).toMatchObject({ id: "tpl-1", status: "published" });
        });

        it("待审核模板匿名访问返回 404", async () => {
            vi.mocked(templateRepo.findTemplateDetail).mockResolvedValue(
                templateRow({ status: "pending", authorId: "other-user" }),
            );
            const res = await app().request("/api/templates/tpl-1");
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "模板不存在" });
        });

        it("待审核模板仅作者可见", async () => {
            vi.mocked(templateRepo.findTemplateDetail).mockResolvedValue(
                templateRow({ status: "pending" }),
            );
            const res = await app().request("/api/templates/tpl-1");
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body).toMatchObject({ status: "pending" });
        });

        it("已驳回模板管理员可见", async () => {
            mockGetSession.mockResolvedValue(adminSession());
            vi.mocked(templateRepo.findTemplateDetail).mockResolvedValue(
                templateRow({ status: "rejected", authorId: "other-user" }),
            );
            const res = await app().request("/api/templates/tpl-1");
            expect(res.status).toBe(200);
            expect((await res.json()) as Record<string, unknown>).toMatchObject(
                { status: "rejected" },
            );
        });
    });

    describe("POST /", () => {
        it("未登录返回 401", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await app().request("/api/templates", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ title: "x", files: [] }),
            });
            expect(res.status).toBe(401);
        });

        it("标题为空返回 400", async () => {
            const res = await app().request("/api/templates", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ title: "  ", files: [] }),
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "模板标题不能为空" });
        });

        it("缺少封面返回 400", async () => {
            const res = await app().request("/api/templates", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    title: "模板",
                    files: [{ name: "main.py", content: "x" }],
                }),
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "请上传模板封面" });
        });

        it("没有文件返回 400", async () => {
            const res = await app().request("/api/templates", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    title: "模板",
                    coverUrl: "https://example.com/cover.png",
                    files: [],
                }),
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({
                error: "请至少添加一个模板文件",
            });
        });

        it("文件名不合法返回 400", async () => {
            const res = await app().request("/api/templates", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    title: "模板",
                    coverUrl: "https://example.com/cover.png",
                    files: [{ name: "a/../b", content: "x" }],
                }),
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "模板文件名不合法" });
        });

        it("成功创建待审核模板", async () => {
            vi.mocked(activityRepo.insertActivity).mockResolvedValue(
                undefined as never,
            );
            const res = await app().request("/api/templates", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    title: "Python 小游戏",
                    description: "演示",
                    category: "game",
                    coverUrl: "https://example.com/cover.png",
                    tags: ["pygame", "游戏"],
                    files: [
                        { name: "main.py", content: "print('hi')" },
                        { name: "README.md", content: "# demo" },
                    ],
                }),
            });
            expect(res.status).toBe(201);
            const body = (await res.json()) as {
                ok: boolean;
                template: { id: string; status: string };
            };
            expect(body).toEqual({
                ok: true,
                template: { id: expect.any(String), status: "pending" },
            });

            expect(templateRepo.createTemplate).toHaveBeenCalledWith(
                expect.objectContaining({
                    authorId: "user-1",
                    workId: null,
                    title: "Python 小游戏",
                    category: "game",
                    coverUrl: "https://example.com/cover.png",
                    tags: JSON.stringify(["pygame", "游戏"]),
                    status: "pending",
                    fileCount: 2,
                }),
            );

            const snapshotKey = `templates/${body.template.id}/snapshot.json`;
            expect(storage.putCalls).toContainEqual(
                expect.objectContaining({ key: snapshotKey }),
            );
            const snapshot = JSON.parse(
                new TextDecoder().decode(
                    storage.store.get(snapshotKey) ?? new Uint8Array(),
                ),
            ) as { files: Array<{ name: string; content: string }> };
            expect(snapshot.files).toHaveLength(2);
            expect(snapshot.files[0]).toEqual({
                name: "main.py",
                contentType: null,
                content: "print('hi')",
            });

            expect(activityRepo.insertActivity).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: "user-1",
                    type: "template",
                }),
            );
        });

        it("二进制文件按 base64 写入快照", async () => {
            const base64 = "aGVsbG8=";
            const res = await app().request("/api/templates", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    title: "带资源模板",
                    coverUrl: "https://example.com/cover.png",
                    files: [
                        {
                            name: "logo.png",
                            contentType: "image/png",
                            content: base64,
                            isBase64: true,
                        },
                    ],
                }),
            });
            expect(res.status).toBe(201);
            const body = (await res.json()) as {
                template: { id: string };
            };
            const snapshot = JSON.parse(
                new TextDecoder().decode(
                    storage.store.get(
                        `templates/${body.template.id}/snapshot.json`,
                    ) ?? new Uint8Array(),
                ),
            ) as { files: Array<Record<string, unknown>> };
            expect(snapshot.files[0]).toEqual({
                name: "logo.png",
                contentType: "image/png",
                content: base64,
                encoding: "base64",
            });
        });
    });

    describe("POST /:id/use", () => {
        it("需要登录", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await app().request("/api/templates/tpl-1/use", {
                method: "POST",
            });
            expect(res.status).toBe(401);
        });

        it("模板不存在返回 404", async () => {
            vi.mocked(templateRepo.findTemplate).mockResolvedValue(undefined);
            const res = await app().request("/api/templates/nope/use", {
                method: "POST",
            });
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "模板不存在" });
        });

        it("待审核模板不可使用（作者本人也拒绝）", async () => {
            vi.mocked(templateRepo.findTemplate).mockResolvedValue(
                templateRow({ status: "pending" }),
            );
            const res = await app().request("/api/templates/tpl-1/use", {
                method: "POST",
            });
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "模板不存在" });
        });

        it("已上架模板可创建草稿并返回 201", async () => {
            vi.mocked(templateRepo.findTemplate).mockResolvedValue(
                templateRow(),
            );
            vi.mocked(workRepo.insertWork).mockResolvedValue({
                id: "new-work",
            } as never);
            vi.mocked(workRepo.insertWorkFiles).mockResolvedValue([
                { id: "f1" },
            ] as never);
            storeSnapshot("tpl-1", [
                {
                    name: "main.js",
                    content: "console.log('hi')",
                    contentType: "text/javascript",
                },
            ]);

            const res = await app().request("/api/templates/tpl-1/use", {
                method: "POST",
            });
            expect(res.status).toBe(201);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body).toMatchObject({ title: "空白项目", files: 1 });
            expect(workRepo.insertWork).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: "user-1",
                    title: "空白项目",
                    status: "draft",
                }),
            );
            expect(templateRepo.bumpTemplateUseCount).toHaveBeenCalledWith(
                "tpl-1",
            );
        });

        it("模板快照数据缺失返回 500", async () => {
            vi.mocked(templateRepo.findTemplate).mockResolvedValue(
                templateRow(),
            );
            storage.store.delete("templates/tpl-1/snapshot.json");
            const res = await app().request("/api/templates/tpl-1/use", {
                method: "POST",
            });
            expect(res.status).toBe(500);
            expect(await res.json()).toEqual({ error: "模板数据不存在" });
        });
    });

    describe("POST /:id/rate", () => {
        it("需要登录", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await app().request("/api/templates/tpl-1/rate", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ score: 5 }),
            });
            expect(res.status).toBe(401);
        });

        it("待审核模板不可评分", async () => {
            vi.mocked(templateRepo.findTemplate).mockResolvedValue(
                templateRow({ status: "pending" }),
            );
            const res = await app().request("/api/templates/tpl-1/rate", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ score: 5 }),
            });
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "模板不存在" });
        });

        it("已上架模板评分成功", async () => {
            vi.mocked(templateRepo.findTemplate).mockResolvedValue(
                templateRow(),
            );
            const res = await app().request("/api/templates/tpl-1/rate", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ score: 5 }),
            });
            expect(res.status).toBe(200);
            expect(templateRepo.rateTemplate).toHaveBeenCalledWith("tpl-1", 5);
        });
    });

    describe("GET /:id/uses", () => {
        it("待审核模板匿名访问返回 404", async () => {
            vi.mocked(templateRepo.findTemplate).mockResolvedValue(
                templateRow({ status: "pending", authorId: "other-user" }),
            );
            const res = await app().request("/api/templates/tpl-1/uses");
            expect(res.status).toBe(404);
        });

        it("待审核模板作者可查看使用记录", async () => {
            vi.mocked(templateRepo.findTemplate).mockResolvedValue(
                templateRow({ status: "pending" }),
            );
            vi.mocked(templateRepo.listTemplateUses).mockResolvedValue([]);
            const res = await app().request("/api/templates/tpl-1/uses");
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual([]);
        });

        it("已上架模板公开可查", async () => {
            vi.mocked(templateRepo.findTemplate).mockResolvedValue(
                templateRow(),
            );
            vi.mocked(templateRepo.listTemplateUses).mockResolvedValue([]);
            const res = await app().request("/api/templates/tpl-1/uses");
            expect(res.status).toBe(200);
        });
    });

    describe("GET /:id/tree", () => {
        it("待审核模板匿名访问返回 404", async () => {
            vi.mocked(templateRepo.findTemplateDetail).mockResolvedValue(
                templateRow({ status: "pending", authorId: "other-user" }),
            );
            const res = await app().request("/api/templates/tpl-1/tree");
            expect(res.status).toBe(404);
        });

        it("已上架模板返回创作脉络", async () => {
            vi.mocked(templateRepo.findTemplateDetail).mockResolvedValue(
                templateRow(),
            );
            vi.mocked(templateRepo.listTemplateUses).mockResolvedValue([]);
            const res = await app().request("/api/templates/tpl-1/tree");
            expect(res.status).toBe(200);
            const body = (await res.json()) as { template: unknown };
            expect(body.template).toMatchObject({ id: "tpl-1" });
        });
    });
});
