import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import * as workRepo from "../src/works/repository.js";
import { versionRoutes } from "../src/works/routes/versionRoutes.js";
import { makeSession, makeWorkFileRow } from "./helpers";
import { mockGetSession, sha256Hex, storage } from "./setup";

describe("versionRoutes", () => {
    function app() {
        return new Hono().route("/api/works", versionRoutes);
    }

    function asOwner() {
        mockGetSession.mockResolvedValue(makeSession({ id: "owner" }));
        vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
    }

    function makeVersionRow(overrides: Record<string, unknown> = {}) {
        return {
            id: "v1",
            workId: "work-1",
            version: 1,
            snapshotKey: "works/work-1/snapshots/v1.json",
            message: "初版",
            createdAt: new Date("2026-01-01T00:00:00Z"),
            ...overrides,
        };
    }

    describe("GET /:id/versions", () => {
        it("返回版本摘要列表", async () => {
            vi.mocked(workRepo.listVersionSummaries).mockResolvedValue([
                { version: 2, message: "更新", createdAt: new Date() },
            ]);
            const res = await app().request("/api/works/work-1/versions");
            expect(res.status).toBe(200);
            expect(workRepo.listVersionSummaries).toHaveBeenCalledWith(
                "work-1",
                200,
            );
            expect(await res.json()).toHaveLength(1);
        });

        it("If-None-Match 命中时返回 304 且不查版本", async () => {
            vi.mocked(workRepo.findWorkUpdatedAt).mockResolvedValue(
                new Date(123),
            );
            const res = await app().request("/api/works/work-1/versions", {
                headers: { "if-none-match": '"123"' },
            });
            expect(res.status).toBe(304);
            expect(workRepo.listVersionSummaries).not.toHaveBeenCalled();
        });

        it("返回 ETag 头（基于作品更新时间）", async () => {
            vi.mocked(workRepo.findWorkUpdatedAt).mockResolvedValue(
                new Date(456),
            );
            vi.mocked(workRepo.listVersionSummaries).mockResolvedValue([]);
            const res = await app().request("/api/works/work-1/versions");
            expect(res.status).toBe(200);
            expect(res.headers.get("etag")).toBe('"456"');
            expect(res.headers.get("cache-control")).toBe("no-cache");
        });

        it("摘要携带提交者信息，无提交者时返回 null", async () => {
            vi.mocked(workRepo.listVersionSummaries).mockResolvedValue([
                {
                    version: 2,
                    message: "更新",
                    createdAt: new Date("2026-01-02T00:00:00Z"),
                    authorId: "user-9",
                    authorName: "李四",
                },
                {
                    version: 1,
                    message: "初版",
                    createdAt: new Date("2026-01-01T00:00:00Z"),
                    authorId: null,
                    authorName: null,
                },
            ]);
            const res = await app().request("/api/works/work-1/versions");
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual([
                {
                    version: 2,
                    message: "更新",
                    createdAt: "2026-01-02T00:00:00.000Z",
                    author: { id: "user-9", name: "李四" },
                },
                {
                    version: 1,
                    message: "初版",
                    createdAt: "2026-01-01T00:00:00.000Z",
                    author: null,
                },
            ]);
        });
    });

    describe("GET /:id/versions/:version", () => {
        it("非法版本号返回 400", async () => {
            for (const raw of ["0", "abc", "-1"]) {
                const res = await app().request(
                    `/api/works/work-1/versions/${raw}`,
                );
                expect(res.status).toBe(400);
                expect(await res.json()).toEqual({ error: "版本号不合法" });
            }
        });

        it("版本不存在返回 404", async () => {
            vi.mocked(workRepo.findVersion).mockResolvedValue(null);
            const res = await app().request("/api/works/work-1/versions/9");
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "版本不存在" });
        });

        it("快照数据丢失返回 500", async () => {
            vi.mocked(workRepo.findVersion).mockResolvedValue(makeVersionRow());
            const res = await app().request("/api/works/work-1/versions/1");
            expect(res.status).toBe(500);
            expect(await res.json()).toEqual({ error: "快照数据丢失" });
        });

        it("返回解析后的快照", async () => {
            vi.mocked(workRepo.findVersion).mockResolvedValue(makeVersionRow());
            const snapshot = {
                version: 1,
                message: null,
                createdAt: 0,
                files: [
                    { key: "k", name: "a.js", contentType: null, content: "x" },
                ],
            };
            storage.store.set(
                "works/work-1/snapshots/v1.json",
                new TextEncoder().encode(JSON.stringify(snapshot)),
            );
            const res = await app().request("/api/works/work-1/versions/1");
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual(snapshot);
        });

        it("哈希引用条目按 blob 解析出内容", async () => {
            vi.mocked(workRepo.findVersion).mockResolvedValue(makeVersionRow());
            const bytes = new TextEncoder().encode("hello");
            const hash = sha256Hex(bytes);
            const snapshot = {
                version: 1,
                message: null,
                createdAt: 0,
                files: [
                    {
                        key: "works/work-1/main.js",
                        name: "main.js",
                        contentType: "text/javascript",
                        size: 5,
                        hash,
                    },
                ],
            };
            storage.store.set(
                "works/work-1/snapshots/v1.json",
                new TextEncoder().encode(JSON.stringify(snapshot)),
            );
            storage.store.set(`works/work-1/blobs/${hash}`, bytes);
            const res = await app().request("/api/works/work-1/versions/1");
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({
                version: 1,
                message: null,
                createdAt: 0,
                files: [
                    {
                        key: "works/work-1/main.js",
                        name: "main.js",
                        contentType: "text/javascript",
                        size: 5,
                        hash,
                        content: "hello",
                    },
                ],
            });
        });
    });

    describe("POST /:id/versions", () => {
        it("需要作者权限", async () => {
            mockGetSession.mockResolvedValue(makeSession({ id: "someone" }));
            vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
            const res = await app().request("/api/works/work-1/versions", {
                method: "POST",
            });
            expect(res.status).toBe(403);
        });

        it("创建版本并写入快照与记录", async () => {
            asOwner();
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([
                makeWorkFileRow({ size: 5 }),
            ]);
            vi.mocked(workRepo.nextVersionNumber).mockResolvedValue(3);
            vi.mocked(workRepo.insertVersion).mockResolvedValue(
                undefined as never,
            );
            storage.store.set(
                "works/work-1/main.js",
                new TextEncoder().encode("hello"),
            );

            const res = await app().request("/api/works/work-1/versions", {
                method: "POST",
                body: JSON.stringify({ message: "  第三版  " }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(201);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body).toMatchObject({
                id: "work-1",
                version: 3,
                message: "第三版",
                fileCount: 1,
            });
            expect(workRepo.insertVersion).toHaveBeenCalledWith(
                expect.objectContaining({
                    workId: "work-1",
                    version: 3,
                    snapshotKey: "works/work-1/snapshots/v3.json",
                    message: "第三版",
                }),
            );
            const stored = storage.store.get("works/work-1/snapshots/v3.json");
            expect(stored).toBeTruthy();
            const parsed = JSON.parse(new TextDecoder().decode(stored)) as {
                version: number;
                files: Array<{ key: string; hash: string; size: number }>;
            };
            const bytes = new TextEncoder().encode("hello");
            expect(parsed.version).toBe(3);
            expect(parsed.files[0]).toEqual({
                key: "works/work-1/main.js",
                name: "main.js",
                contentType: "text/javascript",
                size: 5,
                hash: sha256Hex(bytes),
            });
            expect(
                storage.store.get(`works/work-1/blobs/${sha256Hex(bytes)}`),
            ).toEqual(bytes);
        });

        it("空 message 存为 null", async () => {
            asOwner();
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([]);
            vi.mocked(workRepo.nextVersionNumber).mockResolvedValue(1);
            vi.mocked(workRepo.insertVersion).mockResolvedValue(
                undefined as never,
            );
            const res = await app().request("/api/works/work-1/versions", {
                method: "POST",
                body: JSON.stringify({ message: "   " }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(201);
            expect(workRepo.insertVersion).toHaveBeenCalledWith(
                expect.objectContaining({ message: null }),
            );
        });
    });

    describe("PUT /:id/versions", () => {
        it("需要作者权限", async () => {
            mockGetSession.mockResolvedValue(makeSession({ id: "someone" }));
            vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
            const res = await app().request("/api/works/work-1/versions", {
                method: "PUT",
                body: JSON.stringify({ files: { "main.js": "x" } }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(403);
        });

        it("files 缺失或格式非法返回 400", async () => {
            asOwner();
            for (const body of [
                {},
                { files: [] },
                { files: { "../escape.js": "x" } },
                { files: { "main.js": { nope: true } } },
            ]) {
                const res = await app().request("/api/works/work-1/versions", {
                    method: "PUT",
                    body: JSON.stringify(body),
                    headers: { "content-type": "application/json" },
                });
                expect(res.status).toBe(400);
            }
        });

        it("baseVersion 与最新版本不一致时返回 409 与当前版本", async () => {
            asOwner();
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([]);
            vi.mocked(workRepo.nextVersionNumber).mockResolvedValue(3);
            const res = await app().request("/api/works/work-1/versions", {
                method: "PUT",
                body: JSON.stringify({
                    files: { "main.js": "x" },
                    baseVersion: 1,
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(409);
            expect(await res.json()).toEqual({
                error: "作品已被他人更新，请先获取最新版本",
                currentVersion: 2,
            });
            expect(workRepo.insertVersion).not.toHaveBeenCalled();
        });

        it("baseVersion 匹配时提交成功", async () => {
            asOwner();
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([]);
            vi.mocked(workRepo.nextVersionNumber).mockResolvedValue(3);
            vi.mocked(workRepo.insertVersion).mockResolvedValue(
                undefined as never,
            );
            const res = await app().request("/api/works/work-1/versions", {
                method: "PUT",
                body: JSON.stringify({
                    files: { "main.js": "x" },
                    baseVersion: 2,
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(201);
            expect(workRepo.insertVersion).toHaveBeenCalled();
        });

        it("整树提交：新增/变更/删除文件并写快照", async () => {
            asOwner();
            const bytesA = new TextEncoder().encode("aaa");
            const bytesB = new TextEncoder().encode("bbb");
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([
                makeWorkFileRow({
                    id: "f-a",
                    key: "works/work-1/a.js",
                    name: "a.js",
                }),
                makeWorkFileRow({
                    id: "f-b",
                    key: "works/work-1/b.js",
                    name: "b.js",
                }),
                makeWorkFileRow({
                    id: "f-old",
                    key: "works/work-1/old.js",
                    name: "old.js",
                }),
            ]);
            storage.store.set("works/work-1/a.js", bytesA);
            storage.store.set("works/work-1/b.js", bytesB);
            storage.store.set(
                "works/work-1/old.js",
                new TextEncoder().encode("orphan"),
            );
            vi.mocked(workRepo.nextVersionNumber).mockResolvedValue(2);
            vi.mocked(workRepo.insertVersion).mockResolvedValue(
                undefined as never,
            );

            const newBytes = new TextEncoder().encode("BBB");
            const res = await app().request("/api/works/work-1/versions", {
                method: "PUT",
                body: JSON.stringify({
                    message: "重构",
                    files: {
                        "a.js": "aaa",
                        "b.js": "BBB",
                        "c.js": "new-file",
                    },
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(201);
            expect(await res.json()).toEqual({
                id: "work-1",
                version: 2,
                message: "重构",
                fileCount: 3,
                createdAt: expect.any(String),
                tree: expect.any(String),
                hash: expect.any(String),
            });

            expect(storage.store.get("works/work-1/a.js")).toEqual(bytesA);
            expect(workRepo.bumpWorkFileVersion).not.toHaveBeenCalledWith(
                "f-a",
                expect.any(Number),
            );

            expect(workRepo.bumpWorkFileVersion).toHaveBeenCalledWith("f-b", 3);
            expect(storage.store.get("works/work-1/b.js")).toEqual(newBytes);

            expect(workRepo.insertWorkFiles).toHaveBeenCalledWith([
                expect.objectContaining({
                    workId: "work-1",
                    key: "works/work-1/c.js",
                    name: "c.js",
                    size: 8,
                }),
            ]);

            expect(workRepo.deleteWorkFile).toHaveBeenCalledWith("f-old");
            expect(storage.store.has("works/work-1/old.js")).toBe(false);

            const snapshotRaw = storage.store.get(
                "works/work-1/snapshots/v2.json",
            );
            expect(snapshotRaw).toBeTruthy();
            const snapshot = JSON.parse(
                new TextDecoder().decode(snapshotRaw),
            ) as {
                version: number;
                files: Array<{ name: string; hash: string; size: number }>;
            };
            expect(snapshot.version).toBe(2);
            expect(snapshot.files.map((file) => file.name).sort()).toEqual([
                "a.js",
                "b.js",
                "c.js",
            ]);
            expect(
                storage.store.get(`works/work-1/blobs/${sha256Hex(newBytes)}`),
            ).toEqual(newBytes);
            expect(workRepo.insertVersion).toHaveBeenCalledWith(
                expect.objectContaining({
                    workId: "work-1",
                    version: 2,
                    snapshotKey: "works/work-1/snapshots/v2.json",
                    message: "重构",
                }),
            );
        });

        it("二进制文件按 base64 解码写入", async () => {
            asOwner();
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([]);
            vi.mocked(workRepo.nextVersionNumber).mockResolvedValue(1);
            vi.mocked(workRepo.insertVersion).mockResolvedValue(
                undefined as never,
            );
            const bytes = new Uint8Array([0, 1, 2, 255]);
            const b64 = Buffer.from(bytes).toString("base64");
            const res = await app().request("/api/works/work-1/versions", {
                method: "PUT",
                body: JSON.stringify({
                    files: {
                        "assets/img.png": { b64, contentType: "image/png" },
                    },
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(201);
            expect(storage.store.get("works/work-1/assets/img.png")).toEqual(
                bytes,
            );
            const snapshot = JSON.parse(
                new TextDecoder().decode(
                    storage.store.get("works/work-1/snapshots/v1.json"),
                ),
            ) as { files: Array<{ contentType: string | null }> };
            expect(snapshot.files[0].contentType).toBe("image/png");
        });

        it("manifest 模式按哈希引用对象提交", async () => {
            asOwner();
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([]);
            vi.mocked(workRepo.nextVersionNumber).mockResolvedValue(2);
            vi.mocked(workRepo.insertVersion).mockResolvedValue(
                undefined as never,
            );
            const bytes = new TextEncoder().encode("from-object");
            const hash = sha256Hex(bytes);
            storage.store.set(`works/work-1/blobs/${hash}`, bytes);

            const res = await app().request("/api/works/work-1/versions", {
                method: "PUT",
                body: JSON.stringify({
                    message: "增量提交",
                    manifest: { "main.py": hash },
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(201);
            expect(await res.json()).toEqual({
                id: "work-1",
                version: 2,
                message: "增量提交",
                fileCount: 1,
                createdAt: expect.any(String),
                tree: expect.any(String),
                hash: expect.any(String),
            });

            expect(storage.store.get("works/work-1/main.py")).toEqual(bytes);
            expect(workRepo.insertWorkFiles).toHaveBeenCalledWith([
                expect.objectContaining({
                    key: "works/work-1/main.py",
                    name: "main.py",
                    size: 11,
                }),
            ]);
        });

        it("manifest 引用缺失对象时返回 400", async () => {
            asOwner();
            const res = await app().request("/api/works/work-1/versions", {
                method: "PUT",
                body: JSON.stringify({
                    manifest: { "main.py": "a".repeat(64) },
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({
                error: expect.stringContaining("缺少对象"),
            });
        });

        it("files 与 manifest 同时提供返回 400", async () => {
            asOwner();
            const res = await app().request("/api/works/work-1/versions", {
                method: "PUT",
                body: JSON.stringify({
                    files: { "main.py": "x" },
                    manifest: { "main.py": "a".repeat(64) },
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(400);
        });

        it("提交树与工作区一致时短路返回 unchanged", async () => {
            asOwner();
            const bytes = new TextEncoder().encode("aaa");
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([
                makeWorkFileRow({
                    id: "f-a",
                    key: "works/work-1/a.js",
                    name: "a.js",
                }),
            ]);
            storage.store.set("works/work-1/a.js", bytes);
            vi.mocked(workRepo.nextVersionNumber).mockResolvedValue(2);

            const res = await app().request("/api/works/work-1/versions", {
                method: "PUT",
                body: JSON.stringify({ files: { "a.js": "aaa" } }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as {
                ok: boolean;
                unchanged: boolean;
                version: number;
                tree: string;
            };
            expect(body).toEqual({
                ok: true,
                unchanged: true,
                version: 1,
                tree: expect.any(String),
            });

            expect(workRepo.insertVersion).not.toHaveBeenCalled();
            expect(workRepo.touchWork).not.toHaveBeenCalled();
            expect(storage.store.has("works/work-1/snapshots/v2.json")).toBe(
                false,
            );
        });

        it("提交成功时 touchWork 刷新作品更新时间", async () => {
            asOwner();
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([]);
            vi.mocked(workRepo.nextVersionNumber).mockResolvedValue(1);
            vi.mocked(workRepo.insertVersion).mockResolvedValue(
                undefined as never,
            );
            const res = await app().request("/api/works/work-1/versions", {
                method: "PUT",
                body: JSON.stringify({ files: { "main.js": "x" } }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(201);
            expect(workRepo.touchWork).toHaveBeenCalledWith("work-1");
        });
    });

    describe("POST /:id/versions/:version/restore", () => {
        it("非法版本号返回 400", async () => {
            asOwner();
            const res = await app().request(
                "/api/works/work-1/versions/0/restore",
                {
                    method: "POST",
                },
            );
            expect(res.status).toBe(400);
        });

        it("版本不存在返回 404", async () => {
            asOwner();
            vi.mocked(workRepo.findVersion).mockResolvedValue(null);
            const res = await app().request(
                "/api/works/work-1/versions/9/restore",
                {
                    method: "POST",
                },
            );
            expect(res.status).toBe(404);
        });

        it("快照数据丢失返回 500", async () => {
            asOwner();
            vi.mocked(workRepo.findVersion).mockResolvedValue(makeVersionRow());
            const res = await app().request(
                "/api/works/work-1/versions/1/restore",
                {
                    method: "POST",
                },
            );
            expect(res.status).toBe(500);
        });

        it("已存在文件走版本递增，新文件走新增", async () => {
            asOwner();
            vi.mocked(workRepo.findVersion).mockResolvedValue(makeVersionRow());
            const snapshot = {
                version: 1,
                message: null,
                createdAt: 0,
                files: [
                    {
                        key: "works/work-1/a.js",
                        name: "a.js",
                        contentType: null,
                        content: "aaa",
                    },
                    {
                        key: "works/work-1/b.js",
                        name: "b.js",
                        contentType: null,
                        content: "bbb",
                    },
                ],
            };
            storage.store.set(
                "works/work-1/snapshots/v1.json",
                new TextEncoder().encode(JSON.stringify(snapshot)),
            );
            vi.mocked(workRepo.mapWorkFilesByKey).mockResolvedValue(
                new Map([
                    ["works/work-1/a.js", makeWorkFileRow({ id: "f-a" })],
                ]),
            );
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([]);

            const res = await app().request(
                "/api/works/work-1/versions/1/restore",
                {
                    method: "POST",
                },
            );
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({
                ok: true,
                restoredVersion: 1,
                files: 2,
            });
            expect(workRepo.bumpWorkFileVersion).toHaveBeenCalledWith("f-a", 3);
            expect(workRepo.insertWorkFiles).toHaveBeenCalledWith([
                expect.objectContaining({
                    workId: "work-1",
                    key: "works/work-1/b.js",
                    name: "b.js",
                    size: 3,
                }),
            ]);
            expect(storage.store.get("works/work-1/a.js")).toEqual(
                new TextEncoder().encode("aaa"),
            );
            expect(storage.store.get("works/work-1/b.js")).toEqual(
                new TextEncoder().encode("bbb"),
            );
        });

        it("回滚删除快照中不存在的当前文件", async () => {
            asOwner();
            vi.mocked(workRepo.findVersion).mockResolvedValue(makeVersionRow());
            vi.mocked(workRepo.mapWorkFilesByKey).mockResolvedValue(new Map());
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([
                makeWorkFileRow({
                    id: "f-stale",
                    key: "works/work-1/old.js",
                    name: "old.js",
                }),
            ]);
            const snapshot = {
                version: 1,
                message: null,
                createdAt: 0,
                files: [
                    {
                        key: "works/work-1/main.js",
                        name: "main.js",
                        contentType: null,
                        content: "hi",
                    },
                ],
            };
            storage.store.set(
                "works/work-1/snapshots/v1.json",
                new TextEncoder().encode(JSON.stringify(snapshot)),
            );
            storage.store.set(
                "works/work-1/old.js",
                new TextEncoder().encode("orphan"),
            );

            const res = await app().request(
                "/api/works/work-1/versions/1/restore",
                {
                    method: "POST",
                },
            );
            expect(res.status).toBe(200);
            expect(workRepo.deleteWorkFile).toHaveBeenCalledWith("f-stale");
            expect(storage.store.has("works/work-1/old.js")).toBe(false);
            expect(storage.store.get("works/work-1/main.js")).toEqual(
                new TextEncoder().encode("hi"),
            );
        });

        it("回滚按哈希引用解析 blob 内容", async () => {
            asOwner();
            vi.mocked(workRepo.findVersion).mockResolvedValue(makeVersionRow());
            vi.mocked(workRepo.mapWorkFilesByKey).mockResolvedValue(new Map());
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([]);
            const bytes = new TextEncoder().encode("from-blob");
            const hash = sha256Hex(bytes);
            const snapshot = {
                version: 1,
                message: null,
                createdAt: 0,
                files: [
                    {
                        key: "works/work-1/main.js",
                        name: "main.js",
                        contentType: null,
                        size: 9,
                        hash,
                    },
                ],
            };
            storage.store.set(
                "works/work-1/snapshots/v1.json",
                new TextEncoder().encode(JSON.stringify(snapshot)),
            );
            storage.store.set(`works/work-1/blobs/${hash}`, bytes);

            const res = await app().request(
                "/api/works/work-1/versions/1/restore",
                {
                    method: "POST",
                },
            );
            expect(res.status).toBe(200);
            expect(storage.store.get("works/work-1/main.js")).toEqual(bytes);
            expect(workRepo.insertWorkFiles).toHaveBeenCalledWith([
                expect.objectContaining({
                    key: "works/work-1/main.js",
                    size: 9,
                }),
            ]);
        });
    });

    describe("DELETE /:id/versions/:version", () => {
        it("需要作者权限", async () => {
            mockGetSession.mockResolvedValue(makeSession({ id: "someone" }));
            vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
            const res = await app().request("/api/works/work-1/versions/1", {
                method: "DELETE",
            });
            expect(res.status).toBe(403);
        });

        it("版本不存在返回 404", async () => {
            asOwner();
            vi.mocked(workRepo.findVersion).mockResolvedValue(null);
            const res = await app().request("/api/works/work-1/versions/9", {
                method: "DELETE",
            });
            expect(res.status).toBe(404);
        });

        it("删除快照与版本记录", async () => {
            asOwner();
            vi.mocked(workRepo.findVersion).mockResolvedValue(makeVersionRow());
            storage.store.set(
                "works/work-1/snapshots/v1.json",
                new TextEncoder().encode("{}"),
            );
            const res = await app().request("/api/works/work-1/versions/1", {
                method: "DELETE",
            });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({
                ok: true,
                deletedVersion: 1,
            });
            expect(storage.store.has("works/work-1/snapshots/v1.json")).toBe(
                false,
            );
            expect(workRepo.deleteVersion).toHaveBeenCalledWith("work-1", 1);
        });
    });

    describe("PATCH /:id/versions/:version", () => {
        it("需要作者权限", async () => {
            mockGetSession.mockResolvedValue(makeSession({ id: "someone" }));
            vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
            const res = await app().request("/api/works/work-1/versions/1", {
                method: "PATCH",
                body: JSON.stringify({ message: "改名" }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(403);
        });

        it("版本不存在返回 404", async () => {
            asOwner();
            vi.mocked(workRepo.findVersion).mockResolvedValue(null);
            const res = await app().request("/api/works/work-1/versions/9", {
                method: "PATCH",
                body: JSON.stringify({ message: "改名" }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(404);
        });

        it("修改版本说明", async () => {
            asOwner();
            vi.mocked(workRepo.findVersion).mockResolvedValue(makeVersionRow());
            const res = await app().request("/api/works/work-1/versions/1", {
                method: "PATCH",
                body: JSON.stringify({ message: "  改名后的说明  " }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({
                ok: true,
                version: 1,
                message: "改名后的说明",
            });
            expect(workRepo.renameVersionMessage).toHaveBeenCalledWith(
                "work-1",
                1,
                "改名后的说明",
            );
        });

        it("空白说明存为 null", async () => {
            asOwner();
            vi.mocked(workRepo.findVersion).mockResolvedValue(makeVersionRow());
            const res = await app().request("/api/works/work-1/versions/1", {
                method: "PATCH",
                body: JSON.stringify({ message: "   " }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(200);
            expect(workRepo.renameVersionMessage).toHaveBeenCalledWith(
                "work-1",
                1,
                null,
            );
        });
    });
});
