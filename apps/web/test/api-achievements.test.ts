import { describe, expect, it } from "vitest";
import {
    achievementProgressPath,
    achievementsPath,
    userAchievementsPath,
} from "../src/lib/api/achievements";

describe("api/achievements", () => {
    describe("achievementsPath", () => {
        it("返回成就列表路径", () => {
            expect(achievementsPath()).toBe("/api/achievements");
        });
    });

    describe("userAchievementsPath", () => {
        it("返回指定用户的成就路径", () => {
            expect(userAchievementsPath("u1")).toBe(
                "/api/users/u1/achievements",
            );
        });

        it("不同用户 id 返回不同路径", () => {
            expect(userAchievementsPath("abc")).toBe(
                "/api/users/abc/achievements",
            );
        });
    });

    describe("achievementProgressPath", () => {
        it("返回成就进度路径", () => {
            expect(achievementProgressPath()).toBe(
                "/api/achievements/progress",
            );
        });
    });
});
