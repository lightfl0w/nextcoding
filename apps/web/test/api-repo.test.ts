import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../src/lib/api/http";
import {
    commitPath,
    fetchCommit,
    fetchObject,
    fetchRepo,
    missingObjects,
    repoPath,
    uploadObjectRaw,
    uploadObjects,
    workObjectPath,
} from "../src/lib/api/repo";
import { jsonResponse, setupFetchStub } from "./helpers";

setupFetchStub();

describe("api/repo", () => {
    describe("路径构造", () => {
        it("repoPath / workObjectPath / commitPath", () => {
            expect(repoPath("w1")).toBe("/api/works/w1/repo");
            expect(workObjectPath("w1", "abc")).toBe(
                "/api/works/w1/objects/abc",
            );
            expect(commitPath("w1", "abc")).toBe("/api/works/w1/commits/abc");
        });
    });

    describe("fetchRepo", () => {
        it("返回仓库清单（refs 带提交哈希与父提交）", async () => {
            const ref2 = {
                version: 2,
                message: "v2",
                createdAt: "2026-01-02T00:00:00.000Z",
                tree: "a".repeat(64),
                hash: "b".repeat(64),
                parent: "c".repeat(64),
                author: { id: "u1", name: "张三" },
            };
            const ref1 = {
                version: 1,
                message: "v1",
                createdAt: "2026-01-01T00:00:00.000Z",
                tree: "d".repeat(64),
                hash: "c".repeat(64),
                parent: null,
                author: null,
            };
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({
                    head: ref2,
                    refs: [ref2, ref1],
                    objects: ["a".repeat(64), "b".repeat(64)],
                }),
            );
            await expect(fetchRepo("w1")).resolves.toEqual({
                head: ref2,
                refs: [ref2, ref1],
                objects: ["a".repeat(64), "b".repeat(64)],
            });
            expect(fetch).toHaveBeenCalledWith("/api/works/w1/repo");
        });
    });

    describe("fetchCommit", () => {
        it("按提交哈希返回提交对象", async () => {
            const snapshot = {
                version: 3,
                message: null,
                createdAt: 0,
                files: [],
                hash: "a".repeat(64),
                parent: null,
                tree: "b".repeat(64),
            };
            vi.mocked(fetch).mockResolvedValue(jsonResponse(snapshot));
            await expect(fetchCommit("w1", "a".repeat(64))).resolves.toEqual(
                snapshot,
            );
            expect(fetch).toHaveBeenCalledWith(
                "/api/works/w1/commits/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            );
        });
    });

    describe("fetchObject", () => {
        it("返回对象原始字节", async () => {
            const bytes = new TextEncoder().encode("payload").buffer;
            vi.mocked(fetch).mockResolvedValue(new Response(bytes));
            await expect(fetchObject("w1", "a".repeat(64))).resolves.toEqual(
                new Uint8Array(new TextEncoder().encode("payload")),
            );
            expect(fetch).toHaveBeenCalledWith(
                "/api/works/w1/objects/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            );
        });

        it("失败抛出 HttpError", async () => {
            vi.mocked(fetch).mockResolvedValue(
                new Response("", { status: 404 }),
            );
            await expect(
                fetchObject("w1", "a".repeat(64)),
            ).rejects.toBeInstanceOf(HttpError);
        });
    });

    describe("uploadObjects", () => {
        it("POST 上传缺失对象", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ ok: true, uploaded: 2 }),
            );
            await expect(
                uploadObjects("w1", { ["a".repeat(64)]: "AAAA" }),
            ).resolves.toEqual({ ok: true, uploaded: 2 });
            const [url, init] = vi.mocked(fetch).mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("/api/works/w1/objects");
            expect(init.method).toBe("POST");
            expect(JSON.parse(String(init.body))).toEqual({
                objects: { ["a".repeat(64)]: "AAAA" },
            });
        });

        it("失败抛出 HttpError（携带后端错误信息）", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ error: "内容与哈希不匹配" }, 400),
            );
            const error = await uploadObjects("w1", {}).catch(
                (e: unknown) => e,
            );
            expect(error).toBeInstanceOf(HttpError);
            expect((error as HttpError).message).toBe("内容与哈希不匹配");
        });
    });

    describe("missingObjects", () => {
        it("POST 带本地哈希集合，返回缺失对象", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ missing: ["b".repeat(64)] }),
            );
            await expect(
                missingObjects("w1", ["a".repeat(64)]),
            ).resolves.toEqual({ missing: ["b".repeat(64)] });
            const [url, init] = vi.mocked(fetch).mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("/api/works/w1/objects/missing");
            expect(init.method).toBe("POST");
            expect(JSON.parse(String(init.body))).toEqual({
                has: ["a".repeat(64)],
            });
        });

        it("失败抛出 HttpError", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 400));
            await expect(missingObjects("w1", [])).rejects.toBeInstanceOf(
                HttpError,
            );
        });
    });

    describe("uploadObjectRaw", () => {
        it("PUT 直传原始字节", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ ok: true, uploaded: true }),
            );
            const bytes = new TextEncoder().encode("raw");
            await expect(
                uploadObjectRaw("w1", "a".repeat(64), bytes),
            ).resolves.toEqual({ ok: true, uploaded: true });
            const [url, init] = vi.mocked(fetch).mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe(
                "/api/works/w1/objects/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            );
            expect(init.method).toBe("PUT");
        });

        it("失败抛出 HttpError", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ error: "内容与哈希不匹配" }, 400),
            );
            await expect(
                uploadObjectRaw("w1", "a".repeat(64), new Uint8Array()),
            ).rejects.toBeInstanceOf(HttpError);
        });
    });
});
