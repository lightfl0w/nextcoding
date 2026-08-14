import { describe, expect, it } from "vitest";
import { popularTagsPath, tagDetailPath, tagsPath } from "../src/lib/api/tags";

describe("api/tags", () => {
    describe("tagsPath", () => {
        it("无参数返回基础路径", () => {
            expect(tagsPath()).toBe("/api/tags");
        });

        it("拼接 keyword 参数", () => {
            const path = tagsPath("react");
            expect(
                new URL(path, "http://localhost").searchParams.get("keyword"),
            ).toBe("react");
        });

        it("拼接 sort 参数", () => {
            const path = tagsPath(undefined, "popular");
            expect(
                new URL(path, "http://localhost").searchParams.get("sort"),
            ).toBe("popular");
        });

        it("拼接 limit 参数", () => {
            const path = tagsPath(undefined, undefined, 20);
            expect(
                new URL(path, "http://localhost").searchParams.get("limit"),
            ).toBe("20");
        });

        it("同时拼接所有参数", () => {
            const path = tagsPath("vue", "latest", 10);
            expect(path).toContain("keyword=vue");
            expect(path).toContain("sort=latest");
            expect(path).toContain("limit=10");
        });
    });

    describe("popularTagsPath", () => {
        it("无参数返回基础路径", () => {
            expect(popularTagsPath()).toBe("/api/tags/popular");
        });

        it("拼接 limit 参数", () => {
            expect(popularTagsPath(5)).toBe("/api/tags/popular?limit=5");
        });
    });

    describe("tagDetailPath", () => {
        it("返回带 slug 的路径", () => {
            expect(tagDetailPath("react")).toBe("/api/tags/react");
        });

        it("拼接 sort 参数", () => {
            const path = tagDetailPath("react", "popular");
            expect(
                new URL(path, "http://localhost").searchParams.get("sort"),
            ).toBe("popular");
        });

        it("拼接 limit 参数", () => {
            const path = tagDetailPath("react", undefined, 15);
            expect(
                new URL(path, "http://localhost").searchParams.get("limit"),
            ).toBe("15");
        });

        it("同时拼接 sort 和 limit", () => {
            const path = tagDetailPath("react", "latest", 10);
            expect(path).toContain("sort=latest");
            expect(path).toContain("limit=10");
        });
    });
});
