import { describe, expect, it, vi } from "vitest";
import {
    createWorkFile,
    deleteWorkFile,
    fetchWorkFiles,
    fileContentPath,
    readFileContent,
    saveFileContent,
    workFilesPath,
} from "../src/lib/api/files";
import { HttpError } from "../src/lib/api/http";
import {
    createWork,
    fetchMyWorks,
    fetchWork,
    fetchWorks,
    myWorksKey,
    myWorksPath,
    publishWork,
    updateWorkTitle,
    workPath,
    worksPath,
} from "../src/lib/api/works";
import { jsonResponse, setupFetchStub } from "./helpers";

setupFetchStub();

describe("api/works", () => {
    describe("路径构造", () => {
        it("worksPath 拼接 sort/limit 并转义 keyword", () => {
            expect(worksPath("latest", 10)).toBe(
                "/api/works?sort=latest&limit=10",
            );
            expect(worksPath("popular", 20, "js demo")).toBe(
                "/api/works?sort=popular&limit=20&q=js%20demo",
            );
        });

        it("workPath / myWorksPath / myWorksKey", () => {
            expect(workPath("w1")).toBe("/api/works/w1");
            expect(myWorksPath()).toBe("/api/works/mine");
            expect(myWorksKey("u1")).toEqual(["my-works", "u1"]);
        });
    });

    describe("fetchWorks / fetchWork / fetchMyWorks", () => {
        it("fetchWorks 请求传入的路径", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse([]));
            await fetchWorks("/api/works?sort=latest&limit=10");
            expect(fetch).toHaveBeenCalledWith(
                "/api/works?sort=latest&limit=10",
            );
        });

        it("fetchWork 返回详情", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({ id: "w1" }));
            await expect(fetchWork("/api/works/w1")).resolves.toEqual({
                id: "w1",
            });
        });

        it("fetchMyWorks 请求我的作品接口", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse([]));
            await fetchMyWorks();
            expect(fetch).toHaveBeenCalledWith("/api/works/mine");
        });
    });

    describe("createWork", () => {
        it("创建成功返回新作品 id", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ id: "w-new" }, 201),
            );
            await expect(createWork("标题")).resolves.toEqual({ id: "w-new" });
            const [url, init] = vi.mocked(fetch).mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("/api/works");
            expect(init.method).toBe("POST");
        });

        it("未登录抛出请先登录", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 401));
            await expect(createWork("标题")).rejects.toThrow("请先登录");
        });

        it("其他失败抛出创建失败", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 400));
            await expect(createWork("标题")).rejects.toThrow("创建失败: 400");
        });
    });

    describe("updateWorkTitle", () => {
        it("PATCH 提交标题", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ id: "w1", title: "新标题" }),
            );
            await updateWorkTitle("w1", "新标题");
            const [url, init] = vi.mocked(fetch).mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("/api/works/w1");
            expect(init.method).toBe("PATCH");
            expect(JSON.parse(String(init.body))).toEqual({ title: "新标题" });
        });
    });

    describe("publishWork", () => {
        it("POST 到发布接口", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ ok: true, id: "w1", status: "published" }),
            );
            await expect(publishWork("w1")).resolves.toEqual({
                ok: true,
                id: "w1",
                status: "published",
            });
            const [url, init] = vi.mocked(fetch).mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("/api/works/w1/publish");
            expect(init.method).toBe("POST");
        });

        it("失败抛出发布失败", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 400));
            await expect(publishWork("w1")).rejects.toBeInstanceOf(HttpError);
        });
    });
});

describe("api/files", () => {
    describe("路径构造", () => {
        it("workFilesPath / fileContentPath 转义 key", () => {
            expect(workFilesPath("w1")).toBe("/api/works/w1/files");
            expect(fileContentPath("w1", "works/w1/a b.js")).toBe(
                "/api/works/w1/files/content?key=works%2Fw1%2Fa%20b.js",
            );
        });
    });

    describe("fetchWorkFiles / readFileContent", () => {
        it("fetchWorkFiles 返回文件列表", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({ files: [] }));
            await expect(
                fetchWorkFiles("/api/works/w1/files"),
            ).resolves.toEqual({ files: [] });
        });

        it("readFileContent 成功返回文本", async () => {
            vi.mocked(fetch).mockResolvedValue(new Response("hello"));
            await expect(readFileContent("w1", "k")).resolves.toBe("hello");
        });

        it("readFileContent 失败返回空串", async () => {
            vi.mocked(fetch).mockResolvedValue(
                new Response("", { status: 404 }),
            );
            await expect(readFileContent("w1", "k")).resolves.toBe("");
        });
    });

    describe("createWorkFile", () => {
        it("创建成功返回 created", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ key: "works/w1/a.js", version: 1 }, 201),
            );
            await expect(createWorkFile("w1", "a.js")).resolves.toEqual({
                outcome: "created",
                key: "works/w1/a.js",
                version: 1,
            });
        });

        it("同名文件返回 duplicate", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 409));
            await expect(createWorkFile("w1", "a.js")).resolves.toEqual({
                outcome: "duplicate",
            });
        });

        it("其他失败返回 rejected", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 400));
            await expect(createWorkFile("w1", "a.js")).resolves.toEqual({
                outcome: "rejected",
            });
        });
    });

    describe("saveFileContent", () => {
        it("保存成功返回 saved", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({ version: 3 }));
            await expect(saveFileContent("w1", "k", "hi", 2)).resolves.toEqual({
                outcome: "saved",
                version: 3,
            });
        });

        it("版本冲突返回 conflict 与当前版本", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ currentVersion: 5 }, 409),
            );
            await expect(saveFileContent("w1", "k", "hi", 2)).resolves.toEqual({
                outcome: "conflict",
                currentVersion: 5,
            });
        });

        it("冲突响应缺少版本号时兜底 1", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 409));
            await expect(saveFileContent("w1", "k", "hi", 2)).resolves.toEqual({
                outcome: "conflict",
                currentVersion: 1,
            });
        });

        it("其他失败抛出 HttpError", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 500));
            await expect(
                saveFileContent("w1", "k", "hi", 2),
            ).rejects.toBeInstanceOf(HttpError);
        });
    });

    describe("deleteWorkFile", () => {
        it("DELETE 携带 key 查询参数", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }));
            await deleteWorkFile("w1", "works/w1/a.js");
            const [url, init] = vi.mocked(fetch).mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("/api/works/w1/files?key=works%2Fw1%2Fa.js");
            expect(init.method).toBe("DELETE");
        });
    });
});
