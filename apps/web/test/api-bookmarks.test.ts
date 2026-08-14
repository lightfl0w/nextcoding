import { describe, expect, it } from "vitest";
import { bookmarkPath, userBookmarksPath } from "../src/lib/api/bookmarks";

describe("api/bookmarks", () => {
    describe("bookmarkPath", () => {
        it("返回作品收藏路径", () => {
            expect(bookmarkPath("w1")).toBe("/api/works/w1/bookmark");
        });

        it("不同作品 id 返回不同路径", () => {
            expect(bookmarkPath("abc")).toBe("/api/works/abc/bookmark");
        });
    });

    describe("userBookmarksPath", () => {
        it("无 limit 返回基础路径", () => {
            expect(userBookmarksPath("u1")).toBe("/api/users/u1/bookmarks");
        });

        it("拼接 limit 参数", () => {
            const path = userBookmarksPath("u1", 20);
            expect(path).toBe("/api/users/u1/bookmarks?limit=20");
        });

        it("不同用户 id 返回不同路径", () => {
            expect(userBookmarksPath("u2")).toBe("/api/users/u2/bookmarks");
        });
    });
});
