import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import * as achRepo from "../src/achievements/repository.js";
import { achievementRoutes } from "../src/achievements/routes.js";
import { mockGetSession } from "./setup";

describe("achievementRoutes", () => {
    function app() {
        return new Hono().route("/api/achievements", achievementRoutes);
    }

    function achievementRow(overrides: Record<string, unknown> = {}) {
        return {
            id: "ach-1",
            key: "first_publish",
            name: "初次发布",
            description: "发布你的第一个作品",
            icon: "Rocket",
            category: "publish",
            threshold: 1,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            ...overrides,
        };
    }

    describe("GET /", () => {
        it("返回成就定义数组", async () => {
            vi.mocked(achRepo.listAchievements).mockResolvedValue([
                achievementRow(),
            ] as never);
            const res = await app().request("/api/achievements");
            expect(res.status).toBe(200);
            const body = (await res.json()) as Array<Record<string, unknown>>;
            expect(Array.isArray(body)).toBe(true);
            expect(body[0]).toMatchObject({ key: "first_publish" });
        });
    });

    describe("GET /progress", () => {
        it("需要登录", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await app().request("/api/achievements/progress");
            expect(res.status).toBe(401);
        });

        it("返回带解锁状态与进度的成就", async () => {
            vi.mocked(achRepo.listAchievements).mockResolvedValue([
                achievementRow({ key: "first_publish" }),
                achievementRow({ id: "ach-2", key: "spark_10" }),
            ] as never);
            vi.mocked(achRepo.listUserAchievements).mockResolvedValue([
                { key: "first_publish" },
            ] as never);
            vi.mocked(achRepo.countUserWorks).mockResolvedValue(1);
            vi.mocked(achRepo.countUserReceivedSparks).mockResolvedValue(3);

            const res = await app().request("/api/achievements/progress");
            expect(res.status).toBe(200);
            const body = (await res.json()) as Array<Record<string, unknown>>;
            expect(body[0]).toMatchObject({
                key: "first_publish",
                unlocked: true,
                progress: 1,
            });
            expect(body[1]).toMatchObject({
                key: "spark_10",
                unlocked: false,
                progress: 3,
            });
        });
    });

    describe("GET /:id/achievements", () => {
        it("返回用户已解锁成就", async () => {
            vi.mocked(achRepo.listUserAchievements).mockResolvedValue([
                {
                    id: "ua1",
                    key: "first_publish",
                    name: "初次发布",
                    description: "发布你的第一个作品",
                    icon: "Rocket",
                    category: "publish",
                    threshold: 1,
                    unlockedAt: "2026-01-02T00:00:00Z",
                },
            ] as never);
            const res = await app().request(
                "/api/achievements/user-1/achievements",
            );
            expect(res.status).toBe(200);
            const body = (await res.json()) as Array<Record<string, unknown>>;
            expect(body).toHaveLength(1);
            expect(body[0]).toMatchObject({ key: "first_publish" });
        });
    });
});
