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
});

