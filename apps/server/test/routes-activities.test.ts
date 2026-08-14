import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import * as activityRepo from "../src/activities/repository.js";
import {
    activityFeedRoutes,
    activityUserRoutes,
} from "../src/activities/routes.js";
import { mockGetSession } from "./setup";

describe("activityUserRoutes", () => {
    function app() {
        return new Hono().route("/api/users", activityUserRoutes);
    }

    describe("GET /:id/activities", () => {
        it("用户不存在返回 404", async () => {
            vi.mocked(activityRepo.userExists).mockResolvedValue(false);
            const res = await app().request("/api/users/u1/activities");
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "用户不存在" });
        });

        it("非本人且关闭动态返回 403", async () => {
            vi.mocked(activityRepo.userExists).mockResolvedValue(true);
            mockGetSession.mockResolvedValue({
                user: { id: "viewer", name: "访客" },
                session: { id: "s1" },
            });
            vi.mocked(activityRepo.findActivityVisibility).mockResolvedValue({
                showActivity: false,
            });
            const res = await app().request("/api/users/u1/activities");
            expect(res.status).toBe(403);
            expect(await res.json()).toEqual({
                error: "该用户已关闭动态展示",
            });
        });

        it("返回动态数组", async () => {
            vi.mocked(activityRepo.userExists).mockResolvedValue(true);
            vi.mocked(activityRepo.listUserActivities).mockResolvedValue([
                {
                    id: "a1",
                    type: "spark",
                    createdAt: new Date("2026-01-01T00:00:00Z"),
                    actorId: "u2",
                    actorName: "李四",
                    actorImage: null,
                    workId: "w1",
                    workTitle: "作品A",
                    targetUserId: null,
                    targetUserName: null,
                    targetUserImage: null,
                    commentId: null,
                    commentContent: null,
                },
            ] as never);
            const res = await app().request("/api/users/u1/activities");
            expect(res.status).toBe(200);
            const body = (await res.json()) as Array<Record<string, unknown>>;
            expect(Array.isArray(body)).toBe(true);
            expect(body[0]).toMatchObject({
                id: "a1",
                type: "spark",
                actor: { id: "u2", name: "李四" },
                work: { id: "w1", title: "作品A" },
                targetUser: null,
                comment: null,
            });
        });

        it("follow 动态返回 targetUser 对象", async () => {
            vi.mocked(activityRepo.userExists).mockResolvedValue(true);
            vi.mocked(activityRepo.listUserActivities).mockResolvedValue([
                {
                    id: "a2",
                    type: "follow",
                    createdAt: new Date("2026-01-01T00:00:00Z"),
                    actorId: "u3",
                    actorName: "王五",
                    actorImage: null,
                    workId: null,
                    workTitle: null,
                    targetUserId: "u4",
                    targetUserName: "赵六",
                    targetUserImage: null,
                    commentId: null,
                    commentContent: null,
                },
            ] as never);
            const res = await app().request("/api/users/u1/activities");
            expect(res.status).toBe(200);
            const body = (await res.json()) as Array<Record<string, unknown>>;
            expect(body[0]).toMatchObject({
                type: "follow",
                targetUser: { id: "u4", name: "赵六" },
            });
        });

        it("comment 动态返回 comment 对象", async () => {
            vi.mocked(activityRepo.userExists).mockResolvedValue(true);
            vi.mocked(activityRepo.listUserActivities).mockResolvedValue([
                {
                    id: "a3",
                    type: "comment",
                    createdAt: new Date("2026-01-01T00:00:00Z"),
                    actorId: "u2",
                    actorName: "李四",
                    actorImage: null,
                    workId: "w1",
                    workTitle: "作品A",
                    targetUserId: null,
                    targetUserName: null,
                    targetUserImage: null,
                    commentId: "c1",
                    commentContent: "写得真好",
                },
            ] as never);
            const res = await app().request("/api/users/u1/activities");
            expect(res.status).toBe(200);
            const body = (await res.json()) as Array<Record<string, unknown>>;
            expect(body[0]).toMatchObject({
                comment: { id: "c1", content: "写得真好" },
            });
        });
    });
});

describe("activityFeedRoutes", () => {
    function app() {
        return new Hono().route("/api", activityFeedRoutes);
    }

    it("需要登录", async () => {
        mockGetSession.mockResolvedValue(null);
        const res = await app().request("/api/feed");
        expect(res.status).toBe(401);
    });

    it("返回关注动态数组", async () => {
        vi.mocked(activityRepo.listFeedActivities).mockResolvedValue([
            {
                id: "a1",
                type: "publish",
                createdAt: new Date("2026-01-01T00:00:00Z"),
                actorId: "u2",
                actorName: "李四",
                actorImage: null,
                workId: "w1",
                workTitle: "作品A",
                targetUserId: null,
                targetUserName: null,
                targetUserImage: null,
                commentId: null,
                commentContent: null,
            },
        ] as never);
        const res = await app().request("/api/feed");
        expect(res.status).toBe(200);
        const body = (await res.json()) as Array<Record<string, unknown>>;
        expect(body).toHaveLength(1);
        expect(body[0]).toMatchObject({
            type: "publish",
            work: { id: "w1", title: "作品A" },
        });
    });
});
