import { describe, expect, it, vi } from "vitest";

const rowsMock = vi.fn();

vi.mock("@nextcoding/db", () => {
    const col = (name: string) => ({ sqlName: name }) as never;
    return {
        db: {
            select: vi.fn(() => {
                const query = {
                    from: vi.fn(() => query),
                    leftJoin: vi.fn(() => query),
                    where: vi.fn(() => query),
                    groupBy: vi.fn(() => query),
                    orderBy: vi.fn(() => query),
                    limit: vi.fn(() => Promise.resolve(rowsMock())),
                };
                return query;
            }),
        },
        spark: {
            id: col("spark.id"),
            workId: col("spark.workId"),
            createdAt: col("spark.createdAt"),
        },
        user: {
            id: col("user.id"),
            name: col("user.name"),
            image: col("user.image"),
            bio: col("user.bio"),
        },
        work: {
            id: col("work.id"),
            title: col("work.title"),
            description: col("work.description"),
            coverUrl: col("work.coverUrl"),
            tags: col("work.tags"),
            views: col("work.views"),
            likes: col("work.likes"),
            sparks: col("work.sparks"),
            createdAt: col("work.createdAt"),
            status: col("work.status"),
            userId: col("work.userId"),
        },
    };
});

import { Hono } from "hono";
import { workRoutes } from "../src/works/index.js";
import { leaderboardRoutes } from "../src/works/routes/leaderboardRoutes.js";

describe("leaderboardRoutes", () => {
    function app() {
        return new Hono().route("/api/works", leaderboardRoutes);
    }

    function workRow(overrides: Record<string, unknown> = {}) {
        return {
            workId: "w1",
            title: "作品A",
            description: null,
            coverUrl: null,
            tags: "[]",
            views: 10,
            likes: 2,
            sparks: 5,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            authorId: "user-1",
            authorName: "张三",
            authorImage: null,
            authorBio: null,
            ...overrides,
        };
    }

    function contributorRow(overrides: Record<string, unknown> = {}) {
        return {
            userId: "user-1",
            userName: "张三",
            userImage: null,
            userBio: null,
            totalSparks: 42,
            ...overrides,
        };
    }

    describe("GET /leaderboard", () => {
        it("默认返回本周作品榜", async () => {
            rowsMock.mockReturnValue([workRow({ sparkCount: 5 })]);
            const res = await app().request("/api/works/leaderboard");
            expect(res.status).toBe(200);
            const body = (await res.json()) as Array<Record<string, unknown>>;
            expect(Array.isArray(body)).toBe(true);
            expect(body[0]).toMatchObject({
                position: 1,
                sparks: 5,
                work: {
                    id: "w1",
                    title: "作品A",
                    author: { id: "user-1", name: "张三" },
                },
            });
        });

        it("period=all 返回全时段作品榜", async () => {
            rowsMock.mockReturnValue([workRow({ sparks: 8 })]);
            const res = await app().request(
                "/api/works/leaderboard?period=all",
            );
            expect(res.status).toBe(200);
            const body = (await res.json()) as Array<Record<string, unknown>>;
            expect(body[0]).toMatchObject({
                work: { id: "w1" },
                sparks: 8,
            });
        });

        it("type=contributors 返回贡献者榜", async () => {
            rowsMock.mockReturnValue([contributorRow()]);
            const res = await app().request(
                "/api/works/leaderboard?type=contributors",
            );
            expect(res.status).toBe(200);
            const body = (await res.json()) as Array<Record<string, unknown>>;
            expect(body[0]).toMatchObject({
                position: 1,
                author: { id: "user-1", name: "张三" },
                totalSparks: 42,
            });
        });

        it("limit 上限为 50", async () => {
            rowsMock.mockReturnValue([]);
            await app().request("/api/works/leaderboard?limit=999");
            expect(rowsMock).toHaveBeenCalled();
        });

        it("与完整 workRoutes 组合时静态路径优先于 /:id（回归）", async () => {
            rowsMock.mockReturnValue([workRow({ sparkCount: 5 })]);
            const full = new Hono().route("/api/works", workRoutes);
            const res = await full.request(
                "/api/works/leaderboard?period=weekly&type=works&limit=20",
            );
            expect(res.status).toBe(200);
            const body = (await res.json()) as Array<Record<string, unknown>>;
            expect(body[0]).toMatchObject({ position: 1 });
        });
    });
});
