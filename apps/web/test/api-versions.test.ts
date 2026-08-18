import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../src/lib/api/http";
import {
    commitWorkTree,
    commitWorkTreeByManifest,
    workSnapshotPath,
    workVersionsPath,
} from "../src/lib/api/versions";
import { jsonResponse, setupFetchStub } from "./helpers";

setupFetchStub();

describe("api/versions", () => {
    describe("路径构造", () => {
        it("workVersionsPath / workSnapshotPath", () => {
            expect(workVersionsPath("w1")).toBe("/api/works/w1/versions");
            expect(workSnapshotPath("w1", 3)).toBe("/api/works/w1/versions/3");
        });
    });

    describe("commitWorkTree", () => {
        it("PUT 提交整棵树并返回 committed", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse(
                    {
                        id: "w1",
                        version: 4,
                        message: "重构",
                        createdAt: "2026-01-02T00:00:00.000Z",
                        fileCount: 2,
                        tree: "a".repeat(64),
                        hash: "h".repeat(64),
                    },
                    201,
                ),
            );
            const result = await commitWorkTree(
                "w1",
                { "main.py": "print(1)", "assets/bg.png": { b64: "AA==" } },
                { message: "重构", baseVersion: 3 },
            );
            expect(result).toEqual({
                outcome: "committed",
                version: 4,
                message: "重构",
                fileCount: 2,
                tree: "a".repeat(64),
                hash: "h".repeat(64),
            });
            const [url, init] = vi.mocked(fetch).mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("/api/works/w1/versions");
            expect(init.method).toBe("PUT");
            expect(JSON.parse(String(init.body))).toEqual({
                message: "重构",
                baseVersion: 3,
                files: {
                    "main.py": "print(1)",
                    "assets/bg.png": { b64: "AA==" },
                },
            });
        });

        it("manifest 模式以对象引用提交", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse(
                    {
                        id: "w1",
                        version: 5,
                        message: "增量",
                        createdAt: "2026-01-03T00:00:00.000Z",
                        fileCount: 1,
                        tree: "b".repeat(64),
                        hash: "i".repeat(64),
                    },
                    201,
                ),
            );
            const result = await commitWorkTreeByManifest(
                "w1",
                { "main.py": "c".repeat(64) },
                { baseVersion: 4 },
            );
            expect(result).toEqual({
                outcome: "committed",
                version: 5,
                message: "增量",
                fileCount: 1,
                tree: "b".repeat(64),
                hash: "i".repeat(64),
            });
            const [, init] = vi.mocked(fetch).mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(JSON.parse(String(init.body))).toEqual({
                message: null,
                baseVersion: 4,
                manifest: { "main.py": "c".repeat(64) },
            });
        });

        it("提交树无变化时返回 unchanged", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse(
                    {
                        ok: true,
                        unchanged: true,
                        version: 3,
                        tree: "a".repeat(64),
                    },
                    200,
                ),
            );
            await expect(
                commitWorkTree("w1", { "main.py": "x" }),
            ).resolves.toEqual({
                outcome: "unchanged",
                version: 3,
                tree: "a".repeat(64),
            });
        });

        it("版本落后返回 conflict 与当前版本", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ currentVersion: 5 }, 409),
            );
            await expect(
                commitWorkTree("w1", { "main.py": "x" }, { baseVersion: 3 }),
            ).resolves.toEqual({ outcome: "conflict", currentVersion: 5 });
        });

        it("冲突响应缺少版本号时兜底 0", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 409));
            await expect(commitWorkTree("w1", {})).resolves.toEqual({
                outcome: "conflict",
                currentVersion: 0,
            });
        });

        it("其他失败抛出 HttpError", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 400));
            await expect(commitWorkTree("w1", {})).rejects.toBeInstanceOf(
                HttpError,
            );
        });
    });
});
