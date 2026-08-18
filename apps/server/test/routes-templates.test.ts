import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
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
            fileCount: 1,
            useCount: 0,
            snapshotKey: "templates/tpl-1/snapshot.json",
            createdAt: new Date("2026-01-01T00:00:00Z"),
            updatedAt: new Date("2026-01-01T00:00:00Z"),
            ...overrides,
        };
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
            expect(body[0]).toMatchObject({ title: "空白项目" });
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

        it("返回模板详情", async () => {
            vi.mocked(templateRepo.findTemplateDetail).mockResolvedValue(
                templateRow(),
            );
            const res = await app().request("/api/templates/tpl-1");
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body).toMatchObject({ id: "tpl-1", title: "空白项目" });
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

        it("使用模板创建草稿并返回 201", async () => {
            vi.mocked(templateRepo.findTemplate).mockResolvedValue(
                templateRow(),
            );
            vi.mocked(workRepo.insertWork).mockResolvedValue({
                id: "new-work",
            } as never);
            vi.mocked(workRepo.insertWorkFiles).mockResolvedValue([
                { id: "f1" },
            ] as never);

            storage.store.set(
                "templates/tpl-1/snapshot.json",
                new TextEncoder().encode(
                    JSON.stringify({
                        files: [
                            {
                                name: "main.js",
                                content: "console.log('hi')",
                                contentType: "text/javascript",
                            },
                        ],
                    }),
                ),
            );

            const res = await app().request("/api/templates/tpl-1/use", {
                method: "POST",
            });
            expect(res.status).toBe(201);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body).toMatchObject({ title: "空白项目", files: 1 });
            expect(typeof body.id).toBe("string");
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
});
