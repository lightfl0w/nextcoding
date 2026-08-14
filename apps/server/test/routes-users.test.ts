import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { getStorage } from "../src/storage/storageClient.js";
import { storageRoutes } from "../src/storage/routes.js";
import * as userRepo from "../src/users/repository.js";
import { userRoutes } from "../src/users/routes.js";
import * as workRepo from "../src/works/repository.js";
import { makeWorkSummaryRow } from "./helpers";
import { mockGetSession, storage } from "./setup";

describe("storageRoutes", () => {
    function app() {
        return new Hono().route("/api/storage", storageRoutes);
    }

    it("缺少 key 返回 400", async () => {
        const res = await app().request("/api/storage/");
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "缺少 key" });
    });

    it("文件不存在返回 404", async () => {
        const res = await app().request("/api/storage/missing.png");
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "文件不存在" });
    });

    it("按扩展名推断 content-type 并返回内容", async () => {
        storage.store.set(
            "avatars/u1/a.png",
            new TextEncoder().encode("png-bytes"),
        );
        const res = await app().request("/api/storage/avatars/u1/a.png");
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("image/png");
        expect(await res.text()).toBe("png-bytes");
    });

    it("存储 get 抛错时返回 500", async () => {
        vi.mocked(getStorage).mockReturnValue({
            get: vi.fn().mockRejectedValue(new Error("s3 unavailable")),
        } as never);
        const res = await app().request("/api/storage/avatars/u1/a.png");
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: "存储服务暂不可用" });
    });
});

describe("userRoutes", () => {
    function app() {
        return new Hono().route("/api/users", userRoutes);
    }

    describe("GET /me/stats", () => {
        it("需要登录", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await app().request("/api/users/me/stats");
            expect(res.status).toBe(401);
        });

        it("返回送出与收到的火花数", async () => {
            vi.mocked(userRepo.countGivenSparks).mockResolvedValue(5);
            vi.mocked(userRepo.countReceivedSparks).mockResolvedValue(9);
            const res = await app().request("/api/users/me/stats");
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({
                givenSparks: 5,
                receivedSparks: 9,
            });
        });
    });

    describe("GET /:id", () => {
        const profileRow = {
            id: "user-2",
            name: "李四",
            image: "/api/storage/avatars/user-2/a.png",
            bio: "你好",
            createdAt: new Date("2026-01-01T00:00:00Z"),
        };

        it("未知用户返回 404", async () => {
            vi.mocked(userRepo.findUserProfile).mockResolvedValue(undefined);
            const res = await app().request("/api/users/ghost");
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "用户不存在" });
        });

        it("返回公开资料与统计", async () => {
            vi.mocked(userRepo.findUserProfile).mockResolvedValue(profileRow);
            vi.mocked(userRepo.countFollowers).mockResolvedValue(3);
            vi.mocked(userRepo.countFollowing).mockResolvedValue(2);
            const res = await app().request("/api/users/user-2");
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({
                id: "user-2",
                name: "李四",
                image: "/api/storage/avatars/user-2/a.png",
                bio: "你好",
                createdAt: "2026-01-01T00:00:00.000Z",
                followers: 3,
                following: 2,
                isFollowedByMe: false,
            });
        });

        it("登录查看者已关注时 isFollowedByMe 为 true", async () => {
            vi.mocked(userRepo.findUserProfile).mockResolvedValue(profileRow);
            vi.mocked(userRepo.countFollowers).mockResolvedValue(0);
            vi.mocked(userRepo.countFollowing).mockResolvedValue(0);
            vi.mocked(userRepo.findFollow).mockResolvedValue({ id: "f1" });
            const res = await app().request("/api/users/user-2");
            expect(res.status).toBe(200);
            const body = (await res.json()) as { isFollowedByMe: boolean };
            expect(body.isFollowedByMe).toBe(true);
            expect(userRepo.findFollow).toHaveBeenCalledWith(
                "user-1",
                "user-2",
            );
        });
    });

    describe("GET /:id/works", () => {
        it("未知用户返回 404", async () => {
            vi.mocked(userRepo.findUserProfile).mockResolvedValue(undefined);
            const res = await app().request("/api/users/ghost/works");
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "用户不存在" });
        });

        it("返回该作者的已发布作品", async () => {
            vi.mocked(userRepo.findUserProfile).mockResolvedValue({
                id: "user-2",
                name: "李四",
                image: null,
                bio: null,
                createdAt: new Date("2026-01-01T00:00:00Z"),
            });
            vi.mocked(workRepo.listUserPublishedWorks).mockResolvedValue([
                makeWorkSummaryRow({ id: "w1", sparked: 1 }),
            ]);
            const res = await app().request("/api/users/user-2/works");
            expect(res.status).toBe(200);
            expect(workRepo.listUserPublishedWorks).toHaveBeenCalledWith(
                "user-2",
                20,
                "user-1",
            );
            const body = (await res.json()) as Array<{
                id: string;
                sparked: boolean;
            }>;
            expect(body).toHaveLength(1);
            expect(body[0]).toMatchObject({ id: "w1", sparked: true });
        });
    });

    describe("POST /me/avatar", () => {
        function avatarRequest(file: File | null) {
            const form = new FormData();
            if (file) {
                form.append("file", file);
            }
            return app().request("/api/users/me/avatar", {
                method: "POST",
                body: form,
            });
        }

        it("需要登录", async () => {
            mockGetSession.mockResolvedValue(null);
            const form = new FormData();
            form.append(
                "file",
                new File(["x"], "a.png", { type: "image/png" }),
            );
            const res = await app().request("/api/users/me/avatar", {
                method: "POST",
                body: form,
            });
            expect(res.status).toBe(401);
        });

        it("缺少文件返回 400", async () => {
            const res = await avatarRequest(null);
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({
                error: "请选择上传的图片文件",
            });
        });

        it("不支持的图片格式返回 400", async () => {
            const res = await avatarRequest(
                new File(["x"], "a.gif.png", { type: "image/bmp" }),
            );
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({
                error: "不支持的图片格式，仅允许 JPG、PNG、WebP、GIF",
            });
        });

        it("超过 5MB 返回 400", async () => {
            const big = new Uint8Array(5 * 1024 * 1024 + 1);
            const res = await avatarRequest(
                new File([big], "big.png", { type: "image/png" }),
            );
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({
                error: "图片过大，不能超过 5 MB",
            });
        });

        it("上传成功返回 key 与可访问 url", async () => {
            const res = await avatarRequest(
                new File(["png-data"], "a.png", { type: "image/png" }),
            );
            expect(res.status).toBe(201);
            const body = (await res.json()) as { key: string; url: string };
            expect(body.key).toMatch(/^avatars\/user-1\/[a-f0-9]+\.png$/);
            expect(body.url).toBe(`/api/storage/${body.key}`);
            expect(storage.store.has(body.key)).toBe(true);
            expect(storage.putCalls[0].contentType).toBe("image/png");
        });

        it("上传成功后清理该用户的旧头像，不影响其他用户", async () => {
            storage.store.set(
                "avatars/user-1/old-1.png",
                new TextEncoder().encode("old"),
            );
            storage.store.set(
                "avatars/user-1/old-2.png",
                new TextEncoder().encode("old"),
            );
            storage.store.set(
                "avatars/user-2/a.png",
                new TextEncoder().encode("other"),
            );

            const res = await avatarRequest(
                new File(["png-data"], "a.png", { type: "image/png" }),
            );
            expect(res.status).toBe(201);
            const body = (await res.json()) as { key: string };

            expect(storage.store.has(body.key)).toBe(true);
            expect(storage.store.has("avatars/user-1/old-1.png")).toBe(false);
            expect(storage.store.has("avatars/user-1/old-2.png")).toBe(false);
            expect(storage.store.has("avatars/user-2/a.png")).toBe(true);
        });
    });

    describe("POST /:id/follow", () => {
        it("需要登录", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await app().request("/api/users/u2/follow", {
                method: "POST",
            });
            expect(res.status).toBe(401);
        });

        it("目标用户不存在返回 404", async () => {
            vi.mocked(userRepo.findUserById).mockResolvedValue(undefined);
            const res = await app().request("/api/users/ghost/follow", {
                method: "POST",
            });
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "用户不存在" });
        });

        it("不能关注自己", async () => {
            vi.mocked(userRepo.findUserById).mockResolvedValue({
                id: "user-1",
            });
            const res = await app().request("/api/users/user-1/follow", {
                method: "POST",
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "不能关注自己" });
        });

        it("重复关注返回 409", async () => {
            vi.mocked(userRepo.findUserById).mockResolvedValue({ id: "u2" });
            vi.mocked(userRepo.findFollow).mockResolvedValue({ id: "f1" });
            const res = await app().request("/api/users/u2/follow", {
                method: "POST",
            });
            expect(res.status).toBe(409);
            expect(await res.json()).toEqual({ error: "已经关注过了" });
        });

        it("关注成功", async () => {
            vi.mocked(userRepo.findUserById).mockResolvedValue({ id: "u2" });
            vi.mocked(userRepo.findFollow).mockResolvedValue(undefined);
            const res = await app().request("/api/users/u2/follow", {
                method: "POST",
            });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ following: true });
            expect(userRepo.insertFollow).toHaveBeenCalledWith({
                followerId: "user-1",
                followingId: "u2",
            });
        });
    });

    describe("DELETE /:id/follow", () => {
        it("不能取关自己", async () => {
            const res = await app().request("/api/users/user-1/follow", {
                method: "DELETE",
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "不能关注自己" });
        });

        it("取关成功", async () => {
            const res = await app().request("/api/users/u2/follow", {
                method: "DELETE",
            });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ following: false });
            expect(userRepo.deleteFollow).toHaveBeenCalledWith("user-1", "u2");
        });
    });
});
