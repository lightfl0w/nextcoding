import { describe, expect, it } from "vitest";
import { feedPath, userActivitiesPath } from "../src/lib/api/activities";

describe("api/activities", () => {
    describe("userActivitiesPath", () => {
        it("无参数返回基础路径", () => {
            expect(userActivitiesPath("u1")).toBe("/api/users/u1/activities");
        });

        it("拼接 limit 参数", () => {
            const path = userActivitiesPath("u1", 10);
            expect(
                new URL(path, "http://localhost").searchParams.get("limit"),
            ).toBe("10");
        });

        it("拼接 offset 参数", () => {
            const path = userActivitiesPath("u1", undefined, 20);
            expect(
                new URL(path, "http://localhost").searchParams.get("offset"),
            ).toBe("20");
        });

        it("同时拼接 limit 和 offset", () => {
            const path = userActivitiesPath("u1", 10, 20);
            expect(path).toContain("limit=10");
            expect(path).toContain("offset=20");
        });
    });

    describe("feedPath", () => {
        it("无参数返回基础路径", () => {
            expect(feedPath()).toBe("/api/feed");
        });

        it("拼接 limit 参数", () => {
            const path = feedPath(10);
            expect(
                new URL(path, "http://localhost").searchParams.get("limit"),
            ).toBe("10");
        });

        it("拼接 offset 参数", () => {
            const path = feedPath(undefined, 30);
            expect(
                new URL(path, "http://localhost").searchParams.get("offset"),
            ).toBe("30");
        });

        it("同时拼接 limit 和 offset", () => {
            const path = feedPath(10, 30);
            expect(path).toContain("limit=10");
            expect(path).toContain("offset=30");
        });
    });
});
