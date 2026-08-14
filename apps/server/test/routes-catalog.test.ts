import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import * as workRepo from "../src/works/repository.js";
import { catalogRoutes } from "../src/works/routes/catalogRoutes.js";
import { makeSession, makeWorkSummaryRow } from "./helpers";
import { mockGetSession, storage } from "./setup";

describe("catalogRoutes", () => {
    function app() {
        return new Hono().route("/api/works", catalogRoutes);
    }

    describe("GET /api/works", () => {
        it("默认按 latest 排序并限制分页大小", async () => {
            mockGetSession.mockResolvedValue(null);
            vi.mocked(workRepo.listPublishedWorks).mockResolvedValue([
                makeWorkSummaryRow({ id: "w1", sparked: 1 }),
            ]);
            const res = await app().request("/api/works?sort=bad&limit=1000");
            expect(res.status).toBe(200);
            expect(workRepo.listPublishedWorks).toHaveBeenCalledWith(
                "latest",
                100,
                null,
                undefined,
            );
            const body = (await res.json()) as Array<Record<string, unknown>>;
            expect(body[0]).toMatchObject({ id: "w1", sparked: true });
        });

        it("非法 limit 回退默认值", async () => {
            mockGetSession.mockResolvedValue(null);
            vi.mocked(workRepo.listPublishedWorks).mockResolvedValue([]);
            await app().request("/api/works?limit=abc");
            expect(workRepo.listPublishedWorks).toHaveBeenCalledWith(
                "latest",
                20,
                null,
                undefined,
            );
        });

        it("keyword 去除首尾空白并截断到 64 字符", async () => {
            mockGetSession.mockResolvedValue(null);
            vi.mocked(workRepo.listPublishedWorks).mockResolvedValue([]);
            const keyword = "x".repeat(100);
            await app().request(`/api/works?q=${keyword}`);
            expect(workRepo.listPublishedWorks).toHaveBeenCalledWith(
                "latest",
                20,
                null,
                "x".repeat(64),
            );
        });

        it("登录用户列表携带 viewerId", async () => {
            vi.mocked(workRepo.listPublishedWorks).mockResolvedValue([]);
            await app().request("/api/works?sort=popular");
            expect(workRepo.listPublishedWorks).toHaveBeenCalledWith(
                "popular",
                20,
                "user-1",
                undefined,
            );
        });
    });

    describe("GET /api/works/mine", () => {
        it("需要登录", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await app().request("/api/works/mine");
            expect(res.status).toBe(401);
        });

        it("返回我的作品列表", async () => {
            vi.mocked(workRepo.listOwnedWorks).mockResolvedValue([
                {
                    id: "w1",
                    title: "草稿",
                    status: "draft",
                    sparks: 0,
                    views: 0,
                    createdAt: new Date("2026-01-01T00:00:00Z"),
                    updatedAt: new Date("2026-01-02T00:00:00Z"),
                },
            ]);
            const res = await app().request("/api/works/mine");
            expect(res.status).toBe(200);
            expect(workRepo.listOwnedWorks).toHaveBeenCalledWith("user-1", 200);
            expect(await res.json()).toEqual([
                {
                    id: "w1",
                    title: "草稿",
                    status: "draft",
                    sparks: 0,
                    views: 0,
                    createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
                    updatedAt: new Date("2026-01-02T00:00:00Z").toISOString(),
                },
            ]);
        });
    });

    describe("GET /api/works/:id", () => {
        it("作品不存在返回 404", async () => {
            vi.mocked(workRepo.findWorkDetail).mockResolvedValue(null);
            const res = await app().request("/api/works/work-1");
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "作品不存在" });
        });

        it("返回详情与文件列表", async () => {
            vi.mocked(workRepo.findWorkDetail).mockResolvedValue({
                ...makeWorkSummaryRow(),
                userId: "user-1",
                status: "published",
                updatedAt: new Date("2026-01-02T00:00:00Z"),
                followerCount: 2,
                isFollowing: 1,
            });
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([]);
            const res = await app().request("/api/works/work-1");
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.id).toBe("work-1");
            expect(body.tags).toEqual(["js", "demo"]);
            expect(body.files).toEqual([]);
        });
    });

    describe("POST /api/works", () => {
        async function postWork(form: FormData) {
            return app().request("/api/works", { method: "POST", body: form });
        }

        it("需要登录", async () => {
            mockGetSession.mockResolvedValue(null);
            const form = new FormData();
            form.append("title", "标题");
            const res = await postWork(form);
            expect(res.status).toBe(401);
        });

        it("标题为空返回 400", async () => {
            const form = new FormData();
            form.append("title", "   ");
            const res = await postWork(form);
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "标题不能为空" });
        });

        it("创建草稿并上传文件", async () => {
            vi.mocked(workRepo.insertWork).mockResolvedValue(
                undefined as never,
            );
            vi.mocked(workRepo.insertWorkFiles).mockResolvedValue(
                undefined as never,
            );
            const form = new FormData();
            form.append("title", " 我的作品 ");
            form.append("description", "简介");
            form.append("tags", '["js"]');
            form.append(
                "files",
                new File(["console.log(1)"], "main.js", {
                    type: "text/javascript",
                }),
            );

            const res = await postWork(form);
            expect(res.status).toBe(201);
            const body = (await res.json()) as { id: string; files: number };
            expect(body.files).toBe(1);
            expect(workRepo.insertWork).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: "我的作品",
                    status: "draft",
                    userId: "user-1",
                }),
            );
            expect(storage.store.has(`works/${body.id}/main.js`)).toBe(true);
            expect(workRepo.insertWorkFiles).toHaveBeenCalledWith([
                expect.objectContaining({
                    workId: body.id,
                    name: "main.js",
                    contentType: "text/javascript",
                }),
            ]);
        });

        it("非法文件名返回 400", async () => {
            const form = new FormData();
            form.append("title", "标题");
            form.append("files", new File(["x"], "../escape.js"));
            const res = await postWork(form);
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({
                error: "文件名不合法: ../escape.js",
            });
        });

        it("超过大小限制返回 400", async () => {
            const big = new Uint8Array(21 * 1024 * 1024);
            const form = new FormData();
            form.append("title", "标题");
            form.append("files", new File([big], "big.bin"));
            const res = await postWork(form);
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({
                error: "文件 big.bin 超过 20MB 限制",
            });
        });
    });

    describe("POST /api/works/:id/publish", () => {
        function asOwner() {
            mockGetSession.mockResolvedValue(makeSession({ id: "owner" }));
            vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
        }

        it("无文件不可发布", async () => {
            asOwner();
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([]);
            const res = await app().request("/api/works/work-1/publish", {
                method: "POST",
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({
                error: "发布前请至少创建一个文件",
            });
        });

        it("文件均为空不可发布", async () => {
            asOwner();
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([
                {
                    id: "f1",
                    workId: "work-1",
                    key: "works/work-1/a.js",
                    name: "a.js",
                    size: 0,
                    contentType: null,
                    version: 1,
                    createdAt: new Date(),
                },
            ]);
            const res = await app().request("/api/works/work-1/publish", {
                method: "POST",
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({
                error: "请至少在一个文件里填写内容后再发布",
            });
        });

        it("有内容文件时发布成功", async () => {
            asOwner();
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([
                {
                    id: "f1",
                    workId: "work-1",
                    key: "works/work-1/a.js",
                    name: "a.js",
                    size: 10,
                    contentType: null,
                    version: 1,
                    createdAt: new Date(),
                },
            ]);
            const res = await app().request("/api/works/work-1/publish", {
                method: "POST",
            });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({
                ok: true,
                id: "work-1",
                status: "published",
            });
            expect(workRepo.publishWork).toHaveBeenCalledWith("work-1");
        });

        it("非作者不可发布", async () => {
            mockGetSession.mockResolvedValue(makeSession({ id: "someone" }));
            vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
            const res = await app().request("/api/works/work-1/publish", {
                method: "POST",
            });
            expect(res.status).toBe(403);
        });
    });

    describe("PATCH /api/works/:id", () => {
        it("标题为空返回 400", async () => {
            mockGetSession.mockResolvedValue(makeSession({ id: "owner" }));
            vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
            const res = await app().request("/api/works/work-1", {
                method: "PATCH",
                body: JSON.stringify({ title: "  " }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(400);
        });

        it("修改标题成功", async () => {
            mockGetSession.mockResolvedValue(makeSession({ id: "owner" }));
            vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
            const res = await app().request("/api/works/work-1", {
                method: "PATCH",
                body: JSON.stringify({ title: "  新标题  " }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ id: "work-1", title: "新标题" });
            expect(workRepo.updateWorkTitle).toHaveBeenCalledWith(
                "work-1",
                "新标题",
            );
        });
    });
});
