import { describe, expect, it } from "vitest";
import { leaderboardPath } from "../src/lib/api/leaderboard";

describe("api/leaderboard", () => {
    describe("leaderboardPath", () => {
        it("默认参数拼接 weekly 和 works", () => {
            const path = leaderboardPath();
            expect(
                new URL(path, "http://localhost").searchParams.get("period"),
            ).toBe("weekly");
            expect(
                new URL(path, "http://localhost").searchParams.get("type"),
            ).toBe("works");
        });

        it("自定义 period 参数", () => {
            const path = leaderboardPath("monthly");
            expect(
                new URL(path, "http://localhost").searchParams.get("period"),
            ).toBe("monthly");
        });

        it("自定义 type 参数", () => {
            const path = leaderboardPath("weekly", "contributors");
            expect(
                new URL(path, "http://localhost").searchParams.get("type"),
            ).toBe("contributors");
        });

        it("拼接 limit 参数", () => {
            const path = leaderboardPath("weekly", "works", 10);
            expect(
                new URL(path, "http://localhost").searchParams.get("limit"),
            ).toBe("10");
        });

        it("所有参数同时生效", () => {
            const path = leaderboardPath("all", "contributors", 20);
            expect(path).toContain("period=all");
            expect(path).toContain("type=contributors");
            expect(path).toContain("limit=20");
        });

        it("基础路径正确", () => {
            expect(leaderboardPath()).toContain("/api/works/leaderboard?");
        });
    });
});
