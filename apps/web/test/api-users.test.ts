import { describe, expect, it, vi } from "vitest";
import { followPath, followUser, unfollowUser } from "../src/lib/api/follows";
import {
    fetchMyStats,
    fetchUser,
    fetchUserWorks,
    myStatsPath,
    uploadAvatar,
    userPath,
    userWorksPath,
} from "../src/lib/api/users";
import { jsonResponse, setupFetchStub } from "./helpers";

setupFetchStub();

describe("api/users", () => {
    describe("fetchMyStats", () => {
        it("请求统计接口", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ givenSparks: 1, receivedSparks: 2 }),
            );
            await expect(fetchMyStats()).resolves.toEqual({
                givenSparks: 1,
                receivedSparks: 2,
            });
            expect(fetch).toHaveBeenCalledWith(myStatsPath());
        });
    });

    describe("fetchUser", () => {
        const profile = {
            id: "u2",
            name: "李四",
            image: null,
            bio: "你好",
            createdAt: "2026-01-01T00:00:00.000Z",
            followers: 3,
            following: 2,
            isFollowedByMe: false,
        };

        it("userPath 拼接公开资料路径", () => {
            expect(userPath("u2")).toBe("/api/users/u2");
        });

        it("获取公开资料", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse(profile));
            await expect(fetchUser("u2")).resolves.toEqual(profile);
            expect(fetch).toHaveBeenCalledWith("/api/users/u2");
        });

        it("用户不存在时抛 404 HttpError", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ error: "用户不存在" }, 404),
            );
            await expect(fetchUser("ghost")).rejects.toMatchObject({
                status: 404,
                message: "用户不存在",
            });
        });
    });

    describe("fetchUserWorks", () => {
        it("userWorksPath 拼接作品列表路径", () => {
            expect(userWorksPath("u2", 50)).toBe(
                "/api/users/u2/works?limit=50",
            );
        });

        it("获取某用户的已发布作品", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse([{ id: "w1", title: "作品" }]),
            );
            await expect(fetchUserWorks("u2", 50)).resolves.toEqual([
                { id: "w1", title: "作品" },
            ]);
            expect(fetch).toHaveBeenCalledWith("/api/users/u2/works?limit=50");
        });
    });

    describe("uploadAvatar", () => {
        it("上传成功返回 key 与 url", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse(
                    { key: "avatars/u1/a.png", url: "/api/storage/a.png" },
                    201,
                ),
            );
            const file = new File(["x"], "a.png", { type: "image/png" });
            await expect(uploadAvatar(file)).resolves.toEqual({
                key: "avatars/u1/a.png",
                url: "/api/storage/a.png",
            });
            const [url, init] = vi.mocked(fetch).mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("/api/users/me/avatar");
            expect(init.method).toBe("POST");
            expect(init.body).toBeInstanceOf(FormData);
        });

        it("失败时优先使用服务端错误信息", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ error: "图片过大" }, 400),
            );
            const file = new File(["x"], "a.png", { type: "image/png" });
            await expect(uploadAvatar(file)).rejects.toMatchObject({
                status: 400,
                message: "图片过大",
            });
        });

        it("失败且无错误信息时用默认文案", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 500));
            const file = new File(["x"], "a.png", { type: "image/png" });
            await expect(uploadAvatar(file)).rejects.toMatchObject({
                status: 500,
                message: "上传失败",
            });
        });

        it("响应不是 JSON 时同样抛出 HttpError", async () => {
            vi.mocked(fetch).mockResolvedValue(
                new Response("oops", { status: 500 }),
            );
            const file = new File(["x"], "a.png", { type: "image/png" });
            await expect(uploadAvatar(file)).rejects.toMatchObject({
                status: 500,
                message: "上传失败",
            });
        });
    });
});

describe("api/follows", () => {
    it("followPath 拼接关注路径", () => {
        expect(followPath("u2")).toBe("/api/users/u2/follow");
    });

    it("followUser POST 关注", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ following: true }));
        await expect(followUser("u2")).resolves.toEqual({ following: true });
        const [url, init] = vi.mocked(fetch).mock.calls[0] as [
            string,
            RequestInit,
        ];
        expect(url).toBe("/api/users/u2/follow");
        expect(init.method).toBe("POST");
    });

    it("unfollowUser DELETE 取关", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ following: false }));
        await expect(unfollowUser("u2")).resolves.toEqual({ following: false });
        const [url, init] = vi.mocked(fetch).mock.calls[0] as [
            string,
            RequestInit,
        ];
        expect(url).toBe("/api/users/u2/follow");
        expect(init.method).toBe("DELETE");
    });

    it("重复关注抛 409", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 409));
        await expect(followUser("u2")).rejects.toMatchObject({
            status: 409,
            message: "关注失败",
        });
    });
});
