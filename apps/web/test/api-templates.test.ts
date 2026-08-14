import { describe, expect, it } from "vitest";
import { templatePath, templatesPath } from "../src/lib/api/templates";

describe("api/templates", () => {
    describe("templatesPath", () => {
        it("无参数返回基础路径", () => {
            expect(templatesPath()).toBe("/api/templates");
        });

        it("拼接 category 参数", () => {
            const path = templatesPath("frontend");
            expect(
                new URL(path, "http://localhost").searchParams.get("category"),
            ).toBe("frontend");
        });

        it("拼接 limit 参数", () => {
            const path = templatesPath(undefined, 10);
            expect(
                new URL(path, "http://localhost").searchParams.get("limit"),
            ).toBe("10");
        });

        it("同时拼接 category 和 limit", () => {
            const path = templatesPath("backend", 5);
            expect(path).toContain("category=backend");
            expect(path).toContain("limit=5");
        });
    });

    describe("templatePath", () => {
        it("返回指定模板路径", () => {
            expect(templatePath("t1")).toBe("/api/templates/t1");
        });

        it("不同 id 返回不同路径", () => {
            expect(templatePath("abc")).toBe("/api/templates/abc");
        });
    });
});
