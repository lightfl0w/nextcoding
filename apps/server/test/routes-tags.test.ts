import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import * as tagRepo from "../src/tags/repository.js";
import { tagRoutes } from "../src/tags/routes.js";
import { makeWorkSummaryRow } from "./helpers";

describe("tagRoutes", () => {
    function app() {
        return new Hono().route("/api/tags", tagRoutes);
    }

    function tagRow(overrides: Record<string, unknown> = {}) {
        return {
            id: "t1",
            name: "JavaScript",
            slug: "javascript",
            description: null,
            color: null,
            workCount: 10,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            ...overrides,
        };
    }

    describe("GET /", () => {
        it("返回标签数组", async () => {
            vi.mocked(tagRepo.listTags).mockResolvedValue([tagRow()] as never);
            const res = await app().request("/api/tags");
            expect(res.status).toBe(200);
            const body = (await res.json()) as Array<Record<string, unknown>>;
            expect(Array.isArray(body)).toBe(true);
            expect(body[0]).toMatchObject({
                id: "t1",
                name: "JavaScript",
                slug: "javascript",
            });
        });

        it("支持关键词搜索", async () => {
            vi.mocked(tagRepo.listTags).mockResolvedValue([]);
            await app().request("/api/tags?keyword=react");
            expect(tagRepo.listTags).toHaveBeenCalledWith("react", "name");
        });

        it("支持按热度排序", async () => {
            vi.mocked(tagRepo.listTags).mockResolvedValue([]);
            await app().request("/api/tags?sort=popular");
            expect(tagRepo.listTags).toHaveBeenCalledWith(
                undefined,
                "workCount",
            );
        });

        it("默认按名称排序", async () => {
            vi.mocked(tagRepo.listTags).mockResolvedValue([]);
            await app().request("/api/tags");
            expect(tagRepo.listTags).toHaveBeenCalledWith(undefined, "name");
        });

        it("支持 limit 参数截断结果", async () => {
            vi.mocked(tagRepo.listTags).mockResolvedValue([
                tagRow({ id: "t1", name: "A", slug: "a" }),
                tagRow({ id: "t2", name: "B", slug: "b" }),
                tagRow({ id: "t3", name: "C", slug: "c" }),
            ] as never);
            const res = await app().request("/api/tags?limit=2");
            expect(res.status).toBe(200);
            const body = (await res.json()) as unknown[];
            expect(body).toHaveLength(2);
        });
    });

    describe("GET /popular", () => {
        it("返回热门标签数组", async () => {
            vi.mocked(tagRepo.listPopularTags).mockResolvedValue([
                tagRow({ workCount: 100 }),
            ] as never);
            const res = await app().request("/api/tags/popular");
            expect(res.status).toBe(200);
            const body = (await res.json()) as Array<Record<string, unknown>>;
            expect(Array.isArray(body)).toBe(true);
            expect(body[0]).toMatchObject({ name: "JavaScript" });
        });

        it("默认 limit 为 20", async () => {
            vi.mocked(tagRepo.listPopularTags).mockResolvedValue([]);
            await app().request("/api/tags/popular");
            expect(tagRepo.listPopularTags).toHaveBeenCalledWith(20);
        });

        it("limit 上限为 50", async () => {
            vi.mocked(tagRepo.listPopularTags).mockResolvedValue([]);
            await app().request("/api/tags/popular?limit=999");
            expect(tagRepo.listPopularTags).toHaveBeenCalledWith(50);
        });
    });

    describe("GET /:slug", () => {
        it("标签不存在返回 404", async () => {
            vi.mocked(tagRepo.findTagBySlug).mockResolvedValue(undefined);
            const res = await app().request("/api/tags/not-exist");
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "标签不存在" });
        });

        it("返回标签详情与作品列表", async () => {
            vi.mocked(tagRepo.findTagBySlug).mockResolvedValue(tagRow());
            vi.mocked(tagRepo.listTagWorks).mockResolvedValue([
                makeWorkSummaryRow({ id: "w1", title: "作品A" }),
            ] as never);
            const res = await app().request("/api/tags/javascript");
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body).toMatchObject({ id: "t1", slug: "javascript" });
            expect(Array.isArray(body.works)).toBe(true);
            const works = body.works as Array<Record<string, unknown>>;
            expect(works[0]).toMatchObject({
                id: "w1",
                title: "作品A",
                author: { id: "user-1", name: "张三" },
            });
            expect(tagRepo.listTagWorks).toHaveBeenCalledWith(
                "t1",
                "latest",
                20,
            );
        });

        it("支持按热度排序作品", async () => {
            vi.mocked(tagRepo.findTagBySlug).mockResolvedValue(tagRow());
            vi.mocked(tagRepo.listTagWorks).mockResolvedValue([]);
            await app().request("/api/tags/javascript?sort=popular");
            expect(tagRepo.listTagWorks).toHaveBeenCalledWith(
                "t1",
                "popular",
                20,
            );
        });
    });
});
