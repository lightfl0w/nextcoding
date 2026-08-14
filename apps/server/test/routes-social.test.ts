import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import {
    type NotificationStreamEvent,
    publishNewNotification,
    publishToUser,
    subscribeUser,
} from "../src/works/notificationBus.js";
import * as workRepo from "../src/works/repository.js";
import { commentRoutes } from "../src/works/routes/commentRoutes.js";
import { notificationRoutes } from "../src/works/routes/notificationRoutes.js";
import { remixRoutes } from "../src/works/routes/remixRoutes.js";
import { sparkRoutes } from "../src/works/routes/sparkRoutes.js";
import * as socialRepo from "../src/works/socialRepository.js";
import { makeWorkSummaryRow } from "./helpers";
import { mockGetSession, storage } from "./setup";

describe("commentRoutes", () => {
    function app() {
        return new Hono().route("/api/works", commentRoutes);
    }

    function postComment(body: unknown) {
        return app().request("/api/works/work-1/comments", {
            method: "POST",
            body: JSON.stringify(body),
            headers: { "content-type": "application/json" },
        });
    }

    describe("GET /:id/comments", () => {
        it("返回评论列表", async () => {
            vi.mocked(workRepo.listComments).mockResolvedValue([
                {
                    id: "c1",
                    content: "不错",
                    parentId: null,
                    createdAt: new Date(),
                    authorId: "u2",
                    authorName: "李四",
                    authorImage: null,
                    authorBio: null,
                },
            ]);
            const res = await app().request("/api/works/work-1/comments");
            expect(res.status).toBe(200);
            const body = (await res.json()) as Array<Record<string, unknown>>;
            expect(body[0]).toMatchObject({ id: "c1", content: "不错" });
        });
    });

    describe("POST /:id/comments", () => {
        it("需要登录", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await postComment({ content: "x" });
            expect(res.status).toBe(401);
        });

        it("作品不存在返回 404", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(false);
            const res = await postComment({ content: "x" });
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "作品不存在" });
        });

        it("评论内容为空返回 400", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(true);
            const res = await postComment({ content: "   " });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "评论内容不能为空" });
        });

        it("评论超过 500 字返回 400", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(true);
            const res = await postComment({ content: "长".repeat(501) });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "评论最多 500 字" });
        });

        it("顶级评论成功且不产生通知", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(true);
            vi.mocked(workRepo.insertComment).mockResolvedValue({
                id: "c-new",
                createdAt: new Date("2026-01-01T00:00:00Z"),
            });
            const res = await postComment({
                content: "写得真好",
                parentId: null,
            });
            expect(res.status).toBe(201);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body).toMatchObject({
                id: "c-new",
                content: "写得真好",
                parentId: null,
                author: { id: "user-1", name: "张三" },
            });
            expect(workRepo.insertComment).toHaveBeenCalledWith({
                workId: "work-1",
                userId: "user-1",
                parentId: null,
                content: "写得真好",
            });
            expect(socialRepo.insertNotification).not.toHaveBeenCalled();
        });

        it("父评论不存在或不属于当前作品返回 400", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(true);
            vi.mocked(workRepo.findComment).mockResolvedValue(null);
            const res = await postComment({
                content: "回复",
                parentId: "ghost",
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "父评论不存在" });
        });

        it("允许回复二级评论并通知该评论作者", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(true);
            vi.mocked(workRepo.findComment).mockResolvedValue({
                id: "p1",
                workId: "work-1",
                parentId: "top",
                userId: "u2",
            });
            vi.mocked(workRepo.insertComment).mockResolvedValue({
                id: "c-new",
                createdAt: new Date("2026-01-01T00:00:00Z"),
            });
            const res = await postComment({ content: "回复", parentId: "p1" });
            expect(res.status).toBe(201);
            expect(socialRepo.insertNotification).toHaveBeenCalledWith({
                userId: "u2",
                type: "comment",
                actorId: "user-1",
                workId: "work-1",
                commentId: "c-new",
            });
        });

        it("回复他人评论时产生通知", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(true);
            vi.mocked(workRepo.findComment).mockResolvedValue({
                id: "p1",
                workId: "work-1",
                parentId: null,
                userId: "u2",
            });
            vi.mocked(workRepo.insertComment).mockResolvedValue({
                id: "c-new",
                createdAt: new Date("2026-01-01T00:00:00Z"),
            });
            const res = await postComment({ content: "回复", parentId: "p1" });
            expect(res.status).toBe(201);
            expect(socialRepo.insertNotification).toHaveBeenCalledWith({
                userId: "u2",
                type: "comment",
                actorId: "user-1",
                workId: "work-1",
                commentId: "c-new",
            });
        });

        it("回复自己的评论不产生通知", async () => {
            vi.mocked(workRepo.workExists).mockResolvedValue(true);
            vi.mocked(workRepo.findComment).mockResolvedValue({
                id: "p1",
                workId: "work-1",
                parentId: null,
                userId: "user-1",
            });
            vi.mocked(workRepo.insertComment).mockResolvedValue({
                id: "c-new",
                createdAt: new Date("2026-01-01T00:00:00Z"),
            });
            const res = await postComment({ content: "自回", parentId: "p1" });
            expect(res.status).toBe(201);
            expect(socialRepo.insertNotification).not.toHaveBeenCalled();
        });
    });
});

describe("sparkRoutes", () => {
    function app() {
        return new Hono().route("/api/works", sparkRoutes);
    }

    describe("GET /:id/spark", () => {
        it("需要登录", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await app().request("/api/works/work-1/spark");
            expect(res.status).toBe(401);
        });

        it("返回是否已送过火花", async () => {
            vi.mocked(socialRepo.findSpark).mockResolvedValue({ id: "s1" });
            const res = await app().request("/api/works/work-1/spark");
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ sparked: true });
            expect(socialRepo.findSpark).toHaveBeenCalledWith(
                "work-1",
                "user-1",
            );
        });
    });

    describe("POST /:id/spark", () => {
        it("作品不存在返回 404", async () => {
            vi.mocked(workRepo.findPublishedWorkOwnerId).mockResolvedValue(
                null,
            );
            const res = await app().request("/api/works/work-1/spark", {
                method: "POST",
            });
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "作品不存在" });
        });

        it("不能给自己的作品送火花", async () => {
            vi.mocked(workRepo.findPublishedWorkOwnerId).mockResolvedValue(
                "user-1",
            );
            const res = await app().request("/api/works/work-1/spark", {
                method: "POST",
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({
                error: "不能给自己的作品送火花",
            });
        });

        it("重复送火花返回 409", async () => {
            vi.mocked(workRepo.findPublishedWorkOwnerId).mockResolvedValue(
                "owner",
            );
            vi.mocked(socialRepo.findSpark).mockResolvedValue({ id: "s1" });
            const res = await app().request("/api/works/work-1/spark", {
                method: "POST",
            });
            expect(res.status).toBe(409);
            expect(await res.json()).toEqual({
                error: "已经给这个作品送过火花了",
            });
        });

        it("送火花成功并通知作者", async () => {
            vi.mocked(workRepo.findPublishedWorkOwnerId).mockResolvedValue(
                "owner",
            );
            vi.mocked(socialRepo.findSpark).mockResolvedValue(null);
            const res = await app().request("/api/works/work-1/spark", {
                method: "POST",
            });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ sparked: true });
            expect(socialRepo.insertSpark).toHaveBeenCalledWith({
                workId: "work-1",
                userId: "user-1",
            });
            expect(socialRepo.bumpWorkSparks).toHaveBeenCalledWith("work-1");
            expect(socialRepo.insertNotification).toHaveBeenCalledWith({
                userId: "owner",
                type: "spark",
                actorId: "user-1",
                workId: "work-1",
            });
        });
    });
});

describe("remixRoutes", () => {
    function app() {
        return new Hono().route("/api/works", remixRoutes);
    }

    function publishedDetail() {
        return {
            ...makeWorkSummaryRow(),
            userId: "owner",
            status: "published" as const,
            updatedAt: new Date("2026-01-02T00:00:00Z"),
            followerCount: null,
            isFollowing: null,
            files: [],
        };
    }

    describe("POST /:id/remix", () => {
        it("需要登录", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await app().request("/api/works/work-1/remix", {
                method: "POST",
            });
            expect(res.status).toBe(401);
        });

        it("原作品不存在或未发布返回 404", async () => {
            vi.mocked(workRepo.findWorkDetail).mockResolvedValue(null);
            const res = await app().request("/api/works/work-1/remix", {
                method: "POST",
            });
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "作品不存在" });
        });

        it("二创成功并复制文件", async () => {
            vi.mocked(workRepo.findWorkDetail).mockResolvedValue(
                publishedDetail(),
            );
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([
                {
                    id: "f1",
                    workId: "work-1",
                    key: "works/work-1/main.js",
                    name: "main.js",
                    size: 5,
                    contentType: "text/javascript",
                    version: 1,
                    createdAt: new Date(),
                },
            ]);
            vi.mocked(workRepo.insertWork).mockResolvedValue(
                undefined as never,
            );
            vi.mocked(workRepo.insertWorkFiles).mockResolvedValue(
                undefined as never,
            );
            storage.store.set(
                "works/work-1/main.js",
                new TextEncoder().encode("hello"),
            );

            const res = await app().request("/api/works/work-1/remix", {
                method: "POST",
            });
            expect(res.status).toBe(201);
            const body = (await res.json()) as { id: string; title: string };
            expect(body).toMatchObject({ title: "我的作品" });
            expect(workRepo.insertWork).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: body.id,
                    userId: "user-1",
                    title: "我的作品",
                    status: "draft",
                }),
            );
            expect(socialRepo.insertRemix).toHaveBeenCalledWith({
                originalId: "work-1",
                forkId: body.id,
                userId: "user-1",
            });
            expect(storage.store.has(`works/${body.id}/main.js`)).toBe(true);
        });

        it("二创他人作品时通知原作者", async () => {
            vi.mocked(workRepo.findWorkDetail).mockResolvedValue(
                publishedDetail(),
            );
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([]);
            vi.mocked(workRepo.insertWork).mockResolvedValue(
                undefined as never,
            );
            vi.mocked(workRepo.insertWorkFiles).mockResolvedValue(
                undefined as never,
            );
            const res = await app().request("/api/works/work-1/remix", {
                method: "POST",
            });
            expect(res.status).toBe(201);
            const body = (await res.json()) as { id: string };
            expect(socialRepo.insertNotification).toHaveBeenCalledWith({
                userId: "owner",
                type: "remix",
                actorId: "user-1",
                workId: body.id,
            });
        });

        it("二创自己的作品不产生通知", async () => {
            vi.mocked(workRepo.findWorkDetail).mockResolvedValue({
                ...publishedDetail(),
                userId: "user-1",
            });
            vi.mocked(workRepo.listWorkFiles).mockResolvedValue([]);
            vi.mocked(workRepo.insertWork).mockResolvedValue(
                undefined as never,
            );
            vi.mocked(workRepo.insertWorkFiles).mockResolvedValue(
                undefined as never,
            );
            const res = await app().request("/api/works/work-1/remix", {
                method: "POST",
            });
            expect(res.status).toBe(201);
            expect(socialRepo.insertNotification).not.toHaveBeenCalled();
        });
    });

    describe("GET /:id/source", () => {
        it("返回来源作品（可为 null）", async () => {
            vi.mocked(socialRepo.findSourceByFork).mockResolvedValue({
                id: "work-1",
                title: "原作",
            });
            const res = await app().request("/api/works/work-9/source");
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ id: "work-1", title: "原作" });
        });
    });

    describe("GET /:id/remixes", () => {
        it("返回二创列表", async () => {
            vi.mocked(socialRepo.listDirectRemixes).mockResolvedValue([
                makeWorkSummaryRow({ id: "fork-1" }),
            ]);
            const res = await app().request("/api/works/work-1/remixes");
            expect(res.status).toBe(200);
            const body = (await res.json()) as Array<Record<string, unknown>>;
            expect(body[0]).toMatchObject({ id: "fork-1" });
        });
    });

    describe("GET /:id/tree", () => {
        it("同时返回来源与二创", async () => {
            vi.mocked(socialRepo.findSourceByFork).mockResolvedValue(null);
            vi.mocked(socialRepo.listDirectRemixes).mockResolvedValue([
                makeWorkSummaryRow({ id: "fork-1" }),
            ]);
            const res = await app().request("/api/works/work-1/tree");
            expect(res.status).toBe(200);
            const body = (await res.json()) as {
                source: null;
                remixes: unknown[];
            };
            expect(body.source).toBeNull();
            expect(body.remixes).toHaveLength(1);
        });
    });
});

describe("notificationRoutes", () => {
    function app() {
        return new Hono().route("/api/notifications", notificationRoutes);
    }

    function notificationRow(overrides: Record<string, unknown> = {}) {
        return {
            id: "n1",
            type: "spark" as const,
            read: false,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            actorId: "u2",
            actorName: "李四",
            workId: "work-1",
            workTitle: "我的作品",
            commentId: null,
            commentContent: null,
            ...overrides,
        };
    }

    it("需要登录", async () => {
        mockGetSession.mockResolvedValue(null);
        const res = await app().request("/api/notifications");
        expect(res.status).toBe(401);
    });

    it("返回通知列表", async () => {
        vi.mocked(socialRepo.listNotifications).mockResolvedValue([
            notificationRow(),
        ]);
        const res = await app().request("/api/notifications");
        expect(res.status).toBe(200);
        expect(socialRepo.listNotifications).toHaveBeenCalledWith(
            "user-1",
            100,
        );
        const body = (await res.json()) as Array<Record<string, unknown>>;
        expect(body[0]).toMatchObject({
            id: "n1",
            type: "spark",
            actor: { id: "u2", name: "李四" },
        });
    });

    it("返回未读数", async () => {
        vi.mocked(socialRepo.countUnreadNotifications).mockResolvedValue(3);
        const res = await app().request("/api/notifications/unread-count");
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ count: 3 });
    });

    it("全部标记已读", async () => {
        const res = await app().request("/api/notifications/read-all", {
            method: "POST",
        });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true });
        expect(socialRepo.markAllNotificationsRead).toHaveBeenCalledWith(
            "user-1",
        );
    });

    it("标记单条已读", async () => {
        vi.mocked(socialRepo.countUnreadNotifications).mockResolvedValue(2);
        const res = await app().request("/api/notifications/n1/read", {
            method: "POST",
        });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true, unreadCount: 2 });
        expect(socialRepo.markNotificationRead).toHaveBeenCalledWith(
            "n1",
            "user-1",
        );
    });

    it("SSE 流推送新通知", async () => {
        vi.mocked(socialRepo.listNotifications).mockResolvedValue([
            notificationRow(),
        ]);
        vi.mocked(socialRepo.countUnreadNotifications).mockResolvedValue(1);

        const res = await app().request("/api/notifications/stream");
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("text/event-stream");

        await publishNewNotification("user-1");

        const reader = res.body?.getReader();
        const { value, done } = await reader.read();
        expect(done).toBe(false);
        expect(new TextDecoder().decode(value)).toContain(
            "event: notification",
        );
        await reader.cancel();
    });

    it("总线推送最新通知与未读数", async () => {
        vi.mocked(socialRepo.listNotifications).mockResolvedValue([
            notificationRow(),
        ]);
        vi.mocked(socialRepo.countUnreadNotifications).mockResolvedValue(2);

        const received: NotificationStreamEvent[] = [];
        const unsubscribe = subscribeUser("user-1", (event) =>
            received.push(event),
        );
        try {
            await publishNewNotification("user-1");
        } finally {
            unsubscribe();
        }

        expect(received).toHaveLength(1);
        expect(received[0]).toMatchObject({
            type: "notification",
            payload: { unreadCount: 2 },
        });
    });

    it("取消订阅后不再收到事件", () => {
        const received: NotificationStreamEvent[] = [];
        const unsubscribe = subscribeUser("user-1", (event) =>
            received.push(event),
        );
        unsubscribe();
        publishToUser("user-1", {
            type: "unread",
            payload: { unreadCount: 0 },
        });
        expect(received).toHaveLength(0);
    });
});
