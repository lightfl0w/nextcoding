import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import * as bookmarkRepo from "../src/bookmarks/repository.js";
import { bookmarkRoutes } from "../src/bookmarks/routes.js";
import * as workRepo from "../src/works/repository.js";
import { mockGetSession } from "./setup";

describe("bookmarkRoutes", () => {
    function app() {
        return new Hono().route("/api/works", bookmarkRoutes);
    }

    describe("GET /:id/bookmark", () => {
        it("需要登录", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await app().request("/api/works/w1/bookmark");
            expect(res.status).toBe(401);
        });

        it("已收藏返回 true", async () => {
            vi.mocked(bookmarkRepo.findBookmark).mockResolvedValue({
                id: "b1",
            } as never);
            const res = await app().request("/api/works/w1/bookmark");
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ bookmarked: true });
        });

        it("未收藏返回 false", async () => {
            vi.mocked(bookmarkRepo.findBookmark).mockResolvedValue(undefined);
            const res = await app().request("/api/works/w1/bookmark");
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ bookmarked: false });
        });
    });

    describe("POST /:id/bookmark", () => {
        it("作品不存在返回 404", async () => {
            vi.mocked(workRepo.findPublishedWorkOwnerId).mockResolvedValue(
                undefined,
            );
            const res = await app().request("/api/works/w1/bookmark", {
                method: "POST",
            });
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "作品不存在" });
        });

        it("不能收藏自己的作品", async () => {
            vi.mocked(workRepo.findPublishedWorkOwnerId).mockResolvedValue(
                "user-1",
            );
            const res = await app().request("/api/works/w1/bookmark", {
                method: "POST",
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "不能收藏自己的作品" });
        });

        it("重复收藏返回 409", async () => {
            vi.mocked(workRepo.findPublishedWorkOwnerId).mockResolvedValue(
                "owner-1",
            );
            vi.mocked(bookmarkRepo.findBookmark).mockResolvedValue({
                id: "b1",
            } as never);
            const res = await app().request("/api/works/w1/bookmark", {
                method: "POST",
            });
            expect(res.status).toBe(409);
            expect(await res.json()).toEqual({
                error: "已经收藏过这个作品了",
            });
        });

        it("收藏成功", async () => {
            vi.mocked(workRepo.findPublishedWorkOwnerId).mockResolvedValue(
                "owner-1",
            );
            vi.mocked(bookmarkRepo.findBookmark).mockResolvedValue(undefined);
            const res = await app().request("/api/works/w1/bookmark", {
                method: "POST",
            });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ bookmarked: true });
            expect(bookmarkRepo.insertBookmark).toHaveBeenCalledWith(
                "user-1",
                "w1",
            );
        });
    });

    describe("DELETE /:id/bookmark", () => {
        it("未收藏返回 404", async () => {
            vi.mocked(bookmarkRepo.findBookmark).mockResolvedValue(undefined);
            const res = await app().request("/api/works/w1/bookmark", {
                method: "DELETE",
            });
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "未收藏该作品" });
        });

        it("取消收藏成功", async () => {
            vi.mocked(bookmarkRepo.findBookmark).mockResolvedValue({
                id: "b1",
            } as never);
            const res = await app().request("/api/works/w1/bookmark", {
                method: "DELETE",
            });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ bookmarked: false });
            expect(bookmarkRepo.deleteBookmark).toHaveBeenCalledWith(
                "user-1",
                "w1",
            );
        });
    });

    describe("GET /user/:userId/bookmarks", () => {
        it("隐私关闭且非本人返回 403", async () => {
            mockGetSession.mockResolvedValue({
                user: { id: "viewer", name: "访客" },
                session: { id: "s1" },
            });
            vi.mocked(bookmarkRepo.findBookmarkVisibility).mockResolvedValue({
                showBookmarks: false,
            });
            const res = await app().request("/api/works/user/u1/bookmarks");
            expect(res.status).toBe(403);
            expect(await res.json()).toEqual({
                error: "该用户的收藏列表不公开",
            });
        });

        it("公开收藏返回作品数组", async () => {
            vi.mocked(bookmarkRepo.findBookmarkVisibility).mockResolvedValue({
                showBookmarks: true,
            });
            vi.mocked(bookmarkRepo.listUserBookmarks).mockResolvedValue([
                {
                    bookmarkId: "b1",
                    workId: "w1",
                    title: "作品A",
                    description: null,
                    coverUrl: null,
                    tags: "[]",
                    views: 1,
                    likes: 0,
                    sparks: 0,
                    workCreatedAt: new Date(),
                    authorId: "user-1",
                    authorName: "张三",
                    authorImage: null,
                    authorBio: null,
                },
            ]);
            const res = await app().request("/api/works/user/u1/bookmarks");
            expect(res.status).toBe(200);
            const body = (await res.json()) as Array<Record<string, unknown>>;
            expect(Array.isArray(body)).toBe(true);
            expect(body[0]).toMatchObject({
                id: "w1",
                title: "作品A",
                author: { id: "user-1", name: "张三" },
            });
        });

        it("本人可查看自己的收藏", async () => {
            mockGetSession.mockResolvedValue({
                user: { id: "u1", name: "本人" },
                session: { id: "s1" },
            });
            vi.mocked(bookmarkRepo.listUserBookmarks).mockResolvedValue([
                {
                    bookmarkId: "b1",
                    workId: "w1",
                    title: "作品A",
                    description: null,
                    coverUrl: null,
                    tags: "[]",
                    views: 1,
                    likes: 0,
                    sparks: 0,
                    workCreatedAt: new Date(),
                    authorId: "user-1",
                    authorName: "张三",
                    authorImage: null,
                    authorBio: null,
                },
            ]);
            const res = await app().request("/api/works/user/u1/bookmarks");
            expect(res.status).toBe(200);
            expect(bookmarkRepo.findBookmarkVisibility).not.toHaveBeenCalled();
            const body = (await res.json()) as unknown[];
            expect(body).toHaveLength(1);
        });
    });
});
