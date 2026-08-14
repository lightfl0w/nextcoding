import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import * as workRepo from "../src/works/repository.js";
import { fileRoutes } from "../src/works/routes/fileRoutes.js";
import { makeSession, makeWorkFileRow } from "./helpers";
import { mockGetSession, storage } from "./setup";

describe("fileRoutes", () => {
    function app() {
        return new Hono().route("/api/works", fileRoutes);
    }

    function asOwner() {
        mockGetSession.mockResolvedValue(makeSession({ id: "owner" }));
        vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
    }

    describe("GET /:id/files", () => {
        it("作品不存在返回 404", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(false);
            const res = await app().request("/api/works/work-1/files");
            expect(res.status).toBe(404);
        });

        it("返回文件列表", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(true);
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([
                makeWorkFileRow(),
            ]);
            const res = await app().request("/api/works/work-1/files");
            expect(res.status).toBe(200);
            const body = (await res.json()) as { files: unknown[] };
            expect(body.files).toHaveLength(1);
        });
    });

    describe("GET /:id/files/content", () => {
        it("缺少 key 返回 400", async () => {
            const res = await app().request("/api/works/work-1/files/content");
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "缺少 key" });
        });

        it("文件不存在返回 404", async () => {
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(null);
            const res = await app().request(
                "/api/works/work-1/files/content?key=works/work-1/a.js",
            );
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "文件不存在" });
        });

        it("存储内容缺失返回 404", async () => {
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(
                makeWorkFileRow(),
            );
            const res = await app().request(
                "/api/works/work-1/files/content?key=works/work-1/main.js",
            );
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "内容缺失" });
        });

        it("文本文件返回纯文本", async () => {
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(
                makeWorkFileRow(),
            );
            storage.store.set(
                "works/work-1/main.js",
                new TextEncoder().encode("hi"),
            );
            const res = await app().request(
                "/api/works/work-1/files/content?key=works/work-1/main.js",
            );
            expect(res.status).toBe(200);
            expect(await res.text()).toBe("hi");
        });

        it("二进制文件返回 base64", async () => {
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(
                makeWorkFileRow({ contentType: "image/png" }),
            );
            const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
            storage.store.set("works/work-1/main.js", bytes);
            const res = await app().request(
                "/api/works/work-1/files/content?key=works/work-1/main.js",
            );
            expect(await res.text()).toBe(
                Buffer.from(bytes).toString("base64"),
            );
        });
    });

    describe("POST /:id/files", () => {
        it("需要作者权限", async () => {
            mockGetSession.mockResolvedValue(makeSession({ id: "someone" }));
            vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
            const res = await app().request("/api/works/work-1/files", {
                method: "POST",
                body: JSON.stringify({ name: "a.js", content: "x" }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(403);
        });

        it("非法文件名返回 400", async () => {
            asOwner();
            const res = await app().request("/api/works/work-1/files", {
                method: "POST",
                body: JSON.stringify({ name: "../a.js" }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "文件名不合法" });
        });

        it("同名文件已存在返回 409", async () => {
            asOwner();
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(
                makeWorkFileRow(),
            );
            const res = await app().request("/api/works/work-1/files", {
                method: "POST",
                body: JSON.stringify({ name: "main.js", content: "x" }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(409);
            expect(await res.json()).toEqual({ error: "同名文件已存在" });
        });

        it("非法 base64 内容返回 400", async () => {
            asOwner();
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(null);
            const res = await app().request("/api/works/work-1/files", {
                method: "POST",
                body: JSON.stringify({
                    name: "a.js",
                    content: "not-base64!!!",
                    isBase64: true,
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "base64 内容不合法" });
        });

        it("创建成功写入存储与数据库", async () => {
            asOwner();
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(null);
            const res = await app().request("/api/works/work-1/files", {
                method: "POST",
                body: JSON.stringify({
                    name: "src/a.js",
                    content: "console.log(1)",
                    contentType: "text/javascript",
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(201);
            const body = (await res.json()) as {
                key: string;
                size: number;
                version: number;
            };
            expect(body).toMatchObject({
                key: "works/work-1/src/a.js",
                size: 14,
                version: 1,
            });
            expect(storage.store.get("works/work-1/src/a.js")).toEqual(
                new TextEncoder().encode("console.log(1)"),
            );
            expect(workRepo.insertWorkFile).toHaveBeenCalledWith(
                expect.objectContaining({
                    workId: "work-1",
                    key: "works/work-1/src/a.js",
                    name: "src/a.js",
                    size: 14,
                    contentType: "text/javascript",
                }),
            );
        });
    });

    describe("PUT /:id/files/content", () => {
        it("缺少 key 返回 400", async () => {
            asOwner();
            const res = await app().request("/api/works/work-1/files/content", {
                method: "PUT",
                body: JSON.stringify({ content: "x" }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "缺少 key" });
        });

        it("文件不存在返回 404", async () => {
            asOwner();
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(null);
            const res = await app().request("/api/works/work-1/files/content", {
                method: "PUT",
                body: JSON.stringify({ key: "k", content: "x" }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(404);
        });

        it("版本过期返回 409 与当前版本", async () => {
            asOwner();
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(
                makeWorkFileRow({ version: 3 }),
            );
            const res = await app().request("/api/works/work-1/files/content", {
                method: "PUT",
                body: JSON.stringify({
                    key: "k",
                    content: "x",
                    expectedVersion: 2,
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(409);
            expect(await res.json()).toEqual({
                error: "文件已被他人修改，请刷新后重试",
                currentVersion: 3,
            });
        });

        it("expectedVersion 非整数视为过期", async () => {
            asOwner();
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(
                makeWorkFileRow(),
            );
            const res = await app().request("/api/works/work-1/files/content", {
                method: "PUT",
                body: JSON.stringify({
                    key: "k",
                    content: "x",
                    expectedVersion: "abc",
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(409);
        });

        it("保存成功版本号递增", async () => {
            asOwner();
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(
                makeWorkFileRow(),
            );
            const res = await app().request("/api/works/work-1/files/content", {
                method: "PUT",
                body: JSON.stringify({
                    key: "works/work-1/main.js",
                    content: "hello!",
                    expectedVersion: 1,
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({
                ok: true,
                key: "works/work-1/main.js",
                size: 6,
                version: 2,
            });
            expect(workRepo.setWorkFileVersion).toHaveBeenCalledWith(
                "file-1",
                6,
                2,
            );
            expect(storage.store.get("works/work-1/main.js")).toEqual(
                new TextEncoder().encode("hello!"),
            );
        });
    });

    describe("DELETE /:id/files", () => {
        it("缺少 key 返回 400", async () => {
            asOwner();
            const res = await app().request("/api/works/work-1/files", {
                method: "DELETE",
            });
            expect(res.status).toBe(400);
        });

        it("文件不存在返回 404", async () => {
            asOwner();
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(null);
            const res = await app().request(
                "/api/works/work-1/files?key=works/work-1/a.js",
                { method: "DELETE" },
            );
            expect(res.status).toBe(404);
        });

        it("删除成功清理存储与数据库", async () => {
            asOwner();
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(
                makeWorkFileRow(),
            );
            storage.store.set(
                "works/work-1/main.js",
                new TextEncoder().encode("x"),
            );
            const res = await app().request(
                "/api/works/work-1/files?key=works/work-1/main.js",
                { method: "DELETE" },
            );
            expect(res.status).toBe(200);
            expect(storage.store.has("works/work-1/main.js")).toBe(false);
            expect(workRepo.deleteWorkFile).toHaveBeenCalledWith("file-1");
        });
    });

    describe("PATCH /:id/files", () => {
        it("需要作者权限", async () => {
            mockGetSession.mockResolvedValue(makeSession({ id: "someone" }));
            vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
            const res = await app().request("/api/works/work-1/files", {
                method: "PATCH",
                body: JSON.stringify({
                    key: "works/work-1/main.js",
                    newName: "x.js",
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(403);
        });

        it("非法文件名返回 400", async () => {
            asOwner();
            const res = await app().request("/api/works/work-1/files", {
                method: "PATCH",
                body: JSON.stringify({ key: "k", newName: "../x.js" }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "文件名不合法" });
        });

        it("文件不存在返回 404", async () => {
            asOwner();
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(null);
            const res = await app().request("/api/works/work-1/files", {
                method: "PATCH",
                body: JSON.stringify({
                    key: "works/work-1/main.js",
                    newName: "x.js",
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "文件不存在" });
        });

        it("新名称与现有文件冲突返回 409", async () => {
            asOwner();
            vi.mocked(workRepo.findWorkFileByKey)
                .mockResolvedValueOnce(makeWorkFileRow())
                .mockResolvedValueOnce(
                    makeWorkFileRow({
                        key: "works/work-1/b.js",
                        name: "b.js",
                    }),
                );
            const res = await app().request("/api/works/work-1/files", {
                method: "PATCH",
                body: JSON.stringify({
                    key: "works/work-1/main.js",
                    newName: "b.js",
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(409);
            expect(await res.json()).toEqual({ error: "同名文件已存在" });
        });

        it("存储内容缺失返回 404", async () => {
            asOwner();
            vi.mocked(workRepo.findWorkFileByKey)
                .mockResolvedValueOnce(makeWorkFileRow())
                .mockResolvedValueOnce(null);
            const res = await app().request("/api/works/work-1/files", {
                method: "PATCH",
                body: JSON.stringify({
                    key: "works/work-1/main.js",
                    newName: "b.js",
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "内容缺失" });
        });

        it("新名称不变时直接返回", async () => {
            asOwner();
            vi.mocked(workRepo.findWorkFileByKey).mockResolvedValue(
                makeWorkFileRow(),
            );
            const res = await app().request("/api/works/work-1/files", {
                method: "PATCH",
                body: JSON.stringify({
                    key: "works/work-1/main.js",
                    newName: "main.js",
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({
                ok: true,
                key: "works/work-1/main.js",
                name: "main.js",
                size: 5,
                version: 1,
            });
            expect(storage.putCalls).toHaveLength(0);
            expect(workRepo.renameWorkFile).not.toHaveBeenCalled();
        });

        it("重命名成功移动存储并更新数据库", async () => {
            asOwner();
            vi.mocked(workRepo.findWorkFileByKey)
                .mockResolvedValueOnce(makeWorkFileRow())
                .mockResolvedValueOnce(null);
            storage.store.set(
                "works/work-1/main.js",
                new TextEncoder().encode("hi"),
            );
            const res = await app().request("/api/works/work-1/files", {
                method: "PATCH",
                body: JSON.stringify({
                    key: "works/work-1/main.js",
                    newName: "src/b.js",
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({
                ok: true,
                key: "works/work-1/src/b.js",
                name: "src/b.js",
                size: 5,
                version: 1,
            });
            expect(storage.store.has("works/work-1/main.js")).toBe(false);
            expect(storage.store.get("works/work-1/src/b.js")).toEqual(
                new TextEncoder().encode("hi"),
            );
            expect(workRepo.renameWorkFile).toHaveBeenCalledWith(
                "file-1",
                "works/work-1/src/b.js",
                "src/b.js",
            );
        });
    });

    describe("DELETE /:id/files/folder", () => {
        it("需要作者权限", async () => {
            mockGetSession.mockResolvedValue(makeSession({ id: "someone" }));
            vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
            const res = await app().request(
                "/api/works/work-1/files/folder?name=src",
                { method: "DELETE" },
            );
            expect(res.status).toBe(403);
        });

        it("缺少或非法文件夹名返回 400", async () => {
            asOwner();
            const res = await app().request("/api/works/work-1/files/folder", {
                method: "DELETE",
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "文件夹名不合法" });
        });

        it("文件夹下无文件返回 404", async () => {
            asOwner();
            vi.mocked(workRepo.listWorkFilesByPrefix).mockResolvedValue([]);
            const res = await app().request(
                "/api/works/work-1/files/folder?name=src",
                { method: "DELETE" },
            );
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "文件夹为空或不存在" });
        });

        it("删除成功清理存储与数据库", async () => {
            asOwner();
            vi.mocked(workRepo.listWorkFilesByPrefix).mockResolvedValue([
                makeWorkFileRow({
                    id: "file-1",
                    key: "works/work-1/src/a.js",
                    name: "src/a.js",
                }),
                makeWorkFileRow({
                    id: "file-2",
                    key: "works/work-1/src/b.js",
                    name: "src/b.js",
                }),
            ]);
            storage.store.set(
                "works/work-1/src/a.js",
                new TextEncoder().encode("a"),
            );
            storage.store.set(
                "works/work-1/src/b.js",
                new TextEncoder().encode("b"),
            );
            const res = await app().request(
                "/api/works/work-1/files/folder?name=src",
                { method: "DELETE" },
            );
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ ok: true, deleted: 2 });
            expect(storage.store.has("works/work-1/src/a.js")).toBe(false);
            expect(storage.store.has("works/work-1/src/b.js")).toBe(false);
            expect(workRepo.deleteWorkFilesByIds).toHaveBeenCalledWith([
                "file-1",
                "file-2",
            ]);
        });
    });
});

