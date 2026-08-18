import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import * as workRepo from "../src/works/repository.js";
import { repoRoutes } from "../src/works/routes/repoRoutes.js";
import { makeSession } from "./helpers";
import { mockGetSession, sha256Hex, storage } from "./setup";

describe("repoRoutes", () => {
    function app() {
        return new Hono().route("/api/works", repoRoutes);
    }

    function asOwner() {
        mockGetSession.mockResolvedValue(makeSession({ id: "owner" }));
        vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
    }

    function makeVersionRow(
        version: number,
        overrides: Record<string, unknown> = {},
    ) {
        return {
            id: `v${version}`,
            workId: "work-1",
            version,
            snapshotKey: `works/work-1/snapshots/v${version}.json`,
            message: `v${version}`,
            createdAt: new Date(`2026-01-0${version}T00:00:00Z`),
            ...overrides,
        };
    }

    function seedSnapshot(version: number, files: unknown[]) {
        storage.store.set(
            `works/work-1/snapshots/v${version}.json`,
            new TextEncoder().encode(
                JSON.stringify({
                    version,
                    message: `v${version}`,
                    createdAt: 0,
                    files,
                }),
            ),
        );
    }

    describe("GET /:id/repo", () => {
        it("作品不存在返回 404", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(false);
            const res = await app().request("/api/works/work-1/repo");
            expect(res.status).toBe(404);
        });

        it("返回 head/refs（含树哈希）与对象哈希集合", async () => {
            const bytesA = new TextEncoder().encode("aaa");
            const bytesB = new TextEncoder().encode("bbb");
            const hashA = sha256Hex(bytesA);
            const hashB = sha256Hex(bytesB);
            seedSnapshot(1, [
                {
                    key: "works/work-1/a.js",
                    name: "a.js",
                    contentType: null,
                    size: 3,
                    hash: hashA,
                },
            ]);
            seedSnapshot(2, [
                {
                    key: "works/work-1/a.js",
                    name: "a.js",
                    contentType: null,
                    size: 3,
                    hash: hashA,
                },
                {
                    key: "works/work-1/b.js",
                    name: "b.js",
                    contentType: null,
                    size: 3,
                    hash: hashB,
                },
            ]);
            storage.store.set(`works/work-1/blobs/${hashA}`, bytesA);
            storage.store.set(`works/work-1/blobs/${hashB}`, bytesB);

            storage.store.set(
                "works/work-1/blobs/not-a-hash",
                new TextEncoder().encode("x"),
            );
            storage.store.set(
                "works/other/blobs/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                bytesA,
            );

            vi.mocked(workRepo.workExists).mockResolvedValue(true);
            vi.mocked(workRepo.listVersionSummaries).mockResolvedValue([
                {
                    version: 2,
                    message: "v2",
                    createdAt: new Date("2026-01-02T00:00:00Z"),
                    authorId: "user-9",
                    authorName: "李四",
                },
                {
                    version: 1,
                    message: "v1",
                    createdAt: new Date("2026-01-01T00:00:00Z"),
                    authorId: null,
                    authorName: null,
                },
            ]);
            vi.mocked(workRepo.findVersion).mockImplementation(
                async (_w, version) =>
                    version === 1 || version === 2
                        ? makeVersionRow(version)
                        : null,
            );

            const res = await app().request("/api/works/work-1/repo");
            expect(res.status).toBe(200);
            const body = (await res.json()) as {
                head: { version: number; tree: string; hash: string };
                refs: Array<{
                    version: number;
                    tree: string;
                    hash: string;
                    parent: string | null;
                    author: unknown;
                }>;
                objects: string[];
            };

            expect(body.head).toEqual(
                expect.objectContaining({
                    version: 2,
                    message: "v2",
                    author: { id: "user-9", name: "李四" },
                }),
            );
            expect(body.head.tree).toMatch(/^[0-9a-f]{64}$/);
            expect(body.head.hash).toMatch(/^[0-9a-f]{64}$/);

            expect(body.refs.map((ref) => ref.version)).toEqual([2, 1]);
            expect(body.refs[0].tree).toBe(body.head.tree);
            expect(body.refs[0].tree).not.toBe(body.refs[1].tree);

            expect(body.refs[0].hash).toBe(body.head.hash);
            expect(body.refs[0].parent).toBe(body.refs[1].hash);
            expect(body.refs[1].parent).toBeNull();

            expect(body.objects).toEqual([hashA, hashB].sort());
        });

        it("无版本时 head 为 null", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(true);
            vi.mocked(workRepo.listVersionSummaries).mockResolvedValue([]);
            const res = await app().request("/api/works/work-1/repo");
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({
                head: null,
                refs: [],
                objects: [],
            });
        });

        it("If-None-Match 命中时返回 304 且不查版本", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(true);
            vi.mocked(workRepo.findWorkUpdatedAt).mockResolvedValue(
                new Date(789),
            );
            const res = await app().request("/api/works/work-1/repo", {
                headers: { "if-none-match": '"789"' },
            });
            expect(res.status).toBe(304);
            expect(workRepo.listVersionSummaries).not.toHaveBeenCalled();
        });

        it("版本行已带哈希时短路：不读快照不调 findVersion", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(true);
            vi.mocked(workRepo.findVersion).mockRejectedValue(
                new Error("不应读取旧快照"),
            );
            vi.mocked(workRepo.listVersionSummaries).mockResolvedValue([
                {
                    version: 2,
                    message: "v2",
                    createdAt: new Date("2026-01-02T00:00:00Z"),
                    tree: "a".repeat(64),
                    hash: "b".repeat(64),
                    parent: "c".repeat(64),
                    authorId: "user-9",
                    authorName: "李四",
                },
            ]);
            const res = await app().request("/api/works/work-1/repo");
            expect(res.status).toBe(200);
            const body = (await res.json()) as {
                head: { hash: string; parent: string | null };
                refs: Array<{ hash: string }>;
            };
            expect(body.head).toEqual({
                version: 2,
                message: "v2",
                createdAt: "2026-01-02T00:00:00.000Z",
                tree: "a".repeat(64),
                hash: "b".repeat(64),
                parent: "c".repeat(64),
                author: { id: "user-9", name: "李四" },
            });
            expect(body.refs[0].hash).toBe("b".repeat(64));
        });
    });

    describe("GET /:id/objects/:hash", () => {
        it("非法哈希返回 400", async () => {
            const res = await app().request("/api/works/work-1/objects/zzz");
            expect(res.status).toBe(400);
        });

        it("对象不存在返回 404", async () => {
            const res = await app().request(
                "/api/works/work-1/objects/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            );
            expect(res.status).toBe(404);
        });

        it("返回对象原始字节（内容寻址可永久缓存）", async () => {
            const bytes = new TextEncoder().encode("hello-object");
            const hash = sha256Hex(bytes);
            storage.store.set(`works/work-1/blobs/${hash}`, bytes);
            const res = await app().request(
                `/api/works/work-1/objects/${hash}`,
            );
            expect(res.status).toBe(200);
            expect(res.headers.get("content-type")).toBe(
                "application/octet-stream",
            );
            expect(res.headers.get("cache-control")).toContain("immutable");
            expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
        });
    });

    describe("GET /:id/commits/:hash", () => {
        it("非法哈希返回 400", async () => {
            const res = await app().request("/api/works/work-1/commits/zzz");
            expect(res.status).toBe(400);
        });

        it("提交不存在返回 404", async () => {
            const res = await app().request(
                "/api/works/work-1/commits/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            );
            expect(res.status).toBe(404);
        });

        it("按哈希返回提交对象", async () => {
            const snapshot = {
                version: 3,
                message: "第三版",
                createdAt: 0,
                tree: "a".repeat(64),
                hash: "b".repeat(64),
                parent: "c".repeat(64),
                files: [],
            };
            storage.store.set(
                `works/work-1/commits/${snapshot.hash}`,
                new TextEncoder().encode(JSON.stringify(snapshot)),
            );
            const res = await app().request(
                `/api/works/work-1/commits/${snapshot.hash}`,
            );
            expect(res.status).toBe(200);
            expect(res.headers.get("cache-control")).toContain("immutable");
            expect(await res.json()).toEqual(snapshot);
        });
    });

    describe("POST /:id/objects/missing", () => {
        it("需要作者权限", async () => {
            mockGetSession.mockResolvedValue(makeSession({ id: "someone" }));
            vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
            const res = await app().request(
                "/api/works/work-1/objects/missing",
                {
                    method: "POST",
                    body: JSON.stringify({ has: [] }),
                    headers: { "content-type": "application/json" },
                },
            );
            expect(res.status).toBe(403);
        });

        it("返回服务端缺失的对象哈希", async () => {
            asOwner();
            const bytesA = new TextEncoder().encode("aaa");
            const bytesB = new TextEncoder().encode("bbb");
            const hashA = sha256Hex(bytesA);
            const hashB = sha256Hex(bytesB);
            storage.store.set(`works/work-1/blobs/${hashA}`, bytesA);
            storage.store.set(`works/work-1/blobs/${hashB}`, bytesB);

            const res = await app().request(
                "/api/works/work-1/objects/missing",
                {
                    method: "POST",
                    body: JSON.stringify({
                        has: [hashA, "not-a-hash", "c".repeat(64)],
                    }),
                    headers: { "content-type": "application/json" },
                },
            );
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ missing: [hashB] });
        });

        it("has 非数组或超限返回 400", async () => {
            asOwner();
            for (const body of [
                { has: "abc" },
                { has: new Array(100_001).fill("a".repeat(64)) },
            ]) {
                const res = await app().request(
                    "/api/works/work-1/objects/missing",
                    {
                        method: "POST",
                        body: JSON.stringify(body),
                        headers: { "content-type": "application/json" },
                    },
                );
                expect(res.status).toBe(400);
            }
        });
    });

    describe("PUT /:id/objects/:hash", () => {
        it("需要作者权限", async () => {
            mockGetSession.mockResolvedValue(makeSession({ id: "someone" }));
            vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
            const res = await app().request(
                "/api/works/work-1/objects/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                { method: "PUT" },
            );
            expect(res.status).toBe(403);
        });

        it("直传原始字节并校验哈希", async () => {
            asOwner();
            const bytes = new TextEncoder().encode("raw-bytes");
            const hash = sha256Hex(bytes);
            const res = await app().request(
                `/api/works/work-1/objects/${hash}`,
                { method: "PUT", body: bytes },
            );
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ ok: true, uploaded: true });
            expect(storage.store.get(`works/work-1/blobs/${hash}`)).toEqual(
                bytes,
            );
        });

        it("内容与哈希不匹配返回 400", async () => {
            asOwner();
            const bytes = new TextEncoder().encode("raw-bytes");
            const hash = sha256Hex(new TextEncoder().encode("other"));
            const res = await app().request(
                `/api/works/work-1/objects/${hash}`,
                { method: "PUT", body: bytes },
            );
            expect(res.status).toBe(400);
            expect(storage.store.has(`works/work-1/blobs/${hash}`)).toBe(false);
        });

        it("已存在对象幂等跳过", async () => {
            asOwner();
            const bytes = new TextEncoder().encode("raw-bytes");
            const hash = sha256Hex(bytes);
            storage.store.set(`works/work-1/blobs/${hash}`, bytes);
            const res = await app().request(
                `/api/works/work-1/objects/${hash}`,
                { method: "PUT", body: bytes },
            );
            expect(await res.json()).toEqual({ ok: true, uploaded: false });
        });
    });

    describe("POST /:id/objects", () => {
        it("需要作者权限", async () => {
            mockGetSession.mockResolvedValue(makeSession({ id: "someone" }));
            vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
            const res = await app().request("/api/works/work-1/objects", {
                method: "POST",
                body: JSON.stringify({ objects: {} }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(403);
        });

        it("上传合法对象并写入对象库", async () => {
            asOwner();
            const bytes = new TextEncoder().encode("payload");
            const hash = sha256Hex(bytes);
            const res = await app().request("/api/works/work-1/objects", {
                method: "POST",
                body: JSON.stringify({
                    objects: {
                        [hash]: Buffer.from(bytes).toString("base64"),
                    },
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ ok: true, uploaded: 1 });
            expect(storage.store.get(`works/work-1/blobs/${hash}`)).toEqual(
                bytes,
            );
        });

        it("已存在对象跳过不重复计数", async () => {
            asOwner();
            const bytes = new TextEncoder().encode("payload");
            const hash = sha256Hex(bytes);
            storage.store.set(`works/work-1/blobs/${hash}`, bytes);
            const res = await app().request("/api/works/work-1/objects", {
                method: "POST",
                body: JSON.stringify({
                    objects: {
                        [hash]: Buffer.from(bytes).toString("base64"),
                    },
                }),
                headers: { "content-type": "application/json" },
            });
            expect(await res.json()).toEqual({ ok: true, uploaded: 0 });
        });

        it("内容与哈希不匹配返回 400 且不写入", async () => {
            asOwner();
            const bytes = new TextEncoder().encode("payload");
            const hash = sha256Hex(new TextEncoder().encode("other"));
            const res = await app().request("/api/works/work-1/objects", {
                method: "POST",
                body: JSON.stringify({
                    objects: {
                        [hash]: Buffer.from(bytes).toString("base64"),
                    },
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(400);
            expect(storage.store.has(`works/work-1/blobs/${hash}`)).toBe(false);
        });
    });
});
