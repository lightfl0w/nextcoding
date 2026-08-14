import { describe, expect, it, vi } from "vitest";
import {
    fetchComments,
    postComment,
    workCommentsPath,
} from "../src/lib/api/comments";
import {
    fetchNotifications,
    fetchUnreadCount,
    markNotificationsRead,
    notificationsKey,
    notificationsPath,
    unreadCountKey,
} from "../src/lib/api/notifications";
import {
    fetchWorkRemixes,
    fetchWorkSource,
    remixWork,
    workRemixesPath,
    workRemixPath,
    workSourcePath,
} from "../src/lib/api/remixes";
import {
    fetchWorkSpark,
    giveSpark,
    workSparkPath,
} from "../src/lib/api/sparks";
import {
    fetchSnapshot,
    fetchVersions,
    publishVersion,
    restoreVersion,
    workSnapshotPath,
    workVersionsPath,
} from "../src/lib/api/versions";
import { jsonResponse, setupFetchStub } from "./helpers";

setupFetchStub();

describe("api/comments", () => {
    it("workCommentsPath 拼接作品评论路径", () => {
        expect(workCommentsPath("w1")).toBe("/api/works/w1/comments");
    });

    it("fetchComments 请求传入路径", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse([]));
        await fetchComments("/api/works/w1/comments");
        expect(fetch).toHaveBeenCalledWith("/api/works/w1/comments");
    });

    it("postComment POST 评论内容与父评论", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ id: "c1" }, 201));
        await postComment("w1", "不错", null);
        const [url, init] = vi.mocked(fetch).mock.calls[0] as [
            string,
            RequestInit,
        ];
        expect(url).toBe("/api/works/w1/comments");
        expect(init.method).toBe("POST");
        expect(JSON.parse(String(init.body))).toEqual({
            content: "不错",
            parentId: null,
        });
    });
});

describe("api/notifications", () => {
    it("通知相关路径与 key", () => {
        expect(notificationsPath()).toBe("/api/notifications");
        expect(notificationsKey("u1")).toEqual(["notifications", "u1"]);
        expect(unreadCountKey("u1")).toEqual(["notification-unread", "u1"]);
    });

    it("fetchNotifications 请求通知列表", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse([]));
        await fetchNotifications();
        expect(fetch).toHaveBeenCalledWith("/api/notifications");
    });

    it("fetchUnreadCount 请求未读数", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ count: 3 }));
        await expect(fetchUnreadCount()).resolves.toEqual({ count: 3 });
        expect(fetch).toHaveBeenCalledWith("/api/notifications/unread-count");
    });

    it("markNotificationsRead POST 全部已读", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }));
        await expect(markNotificationsRead()).resolves.toEqual({ ok: true });
        const [url, init] = vi.mocked(fetch).mock.calls[0] as [
            string,
            RequestInit,
        ];
        expect(url).toBe("/api/notifications/read-all");
        expect(init.method).toBe("POST");
    });
});

describe("api/remixes", () => {
    it("二创相关路径", () => {
        expect(workRemixPath("w1")).toBe("/api/works/w1/remix");
        expect(workSourcePath("w1")).toBe("/api/works/w1/source");
        expect(workRemixesPath("w1")).toBe("/api/works/w1/remixes");
    });

    it("remixWork POST 创建二创", async () => {
        vi.mocked(fetch).mockResolvedValue(
            jsonResponse({ id: "w2", title: "副本" }, 201),
        );
        await expect(remixWork("w1")).resolves.toEqual({
            id: "w2",
            title: "副本",
        });
        const [url, init] = vi.mocked(fetch).mock.calls[0] as [
            string,
            RequestInit,
        ];
        expect(url).toBe("/api/works/w1/remix");
        expect(init.method).toBe("POST");
    });

    it("fetchWorkSource 返回来源（可为 null）", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse(null));
        await expect(fetchWorkSource("w2")).resolves.toBeNull();
    });

    it("fetchWorkRemixes 返回列表", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse([]));
        await fetchWorkRemixes("w1");
        expect(fetch).toHaveBeenCalledWith("/api/works/w1/remixes");
    });
});

describe("api/sparks", () => {
    it("workSparkPath 拼接火花路径", () => {
        expect(workSparkPath("w1")).toBe("/api/works/w1/spark");
    });

    it("fetchWorkSpark 返回是否已送火花", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ sparked: true }));
        await expect(fetchWorkSpark("w1")).resolves.toEqual({ sparked: true });
        expect(fetch).toHaveBeenCalledWith("/api/works/w1/spark");
    });

    it("giveSpark POST 送火花", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ sparked: true }));
        await expect(giveSpark("w1")).resolves.toEqual({ sparked: true });
        const [url, init] = vi.mocked(fetch).mock.calls[0] as [
            string,
            RequestInit,
        ];
        expect(url).toBe("/api/works/w1/spark");
        expect(init.method).toBe("POST");
    });

    it("已送过时抛出 HttpError", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 409));
        await expect(giveSpark("w1")).rejects.toMatchObject({
            status: 409,
            message: "送火花失败",
        });
    });
});

describe("api/versions", () => {
    it("版本与快照路径", () => {
        expect(workVersionsPath("w1")).toBe("/api/works/w1/versions");
        expect(workSnapshotPath("w1", 2)).toBe("/api/works/w1/versions/2");
    });

    it("fetchVersions 请求版本列表", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse([]));
        await fetchVersions("w1");
        expect(fetch).toHaveBeenCalledWith("/api/works/w1/versions");
    });

    it("fetchSnapshot 请求快照", async () => {
        const snapshot = {
            version: 2,
            message: null,
            createdAt: 0,
            files: [],
        };
        vi.mocked(fetch).mockResolvedValue(jsonResponse(snapshot));
        await expect(fetchSnapshot("w1", 2)).resolves.toEqual(snapshot);
    });

    it("publishVersion POST 版本说明", async () => {
        vi.mocked(fetch).mockResolvedValue(
            jsonResponse({ version: 3, message: "更新", createdAt: "t" }, 201),
        );
        await publishVersion("w1", "更新");
        const [url, init] = vi.mocked(fetch).mock.calls[0] as [
            string,
            RequestInit,
        ];
        expect(url).toBe("/api/works/w1/versions");
        expect(init.method).toBe("POST");
        expect(JSON.parse(String(init.body))).toEqual({ message: "更新" });
    });

    it("restoreVersion POST 回滚指定版本", async () => {
        vi.mocked(fetch).mockResolvedValue(
            jsonResponse({ ok: true, restoredVersion: 2, files: 3 }),
        );
        await expect(restoreVersion("w1", 2)).resolves.toEqual({
            ok: true,
            restoredVersion: 2,
            files: 3,
        });
        const [url, init] = vi.mocked(fetch).mock.calls[0] as [
            string,
            RequestInit,
        ];
        expect(url).toBe("/api/works/w1/versions/2/restore");
        expect(init.method).toBe("POST");
    });
});
