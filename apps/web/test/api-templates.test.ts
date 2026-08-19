import { describe, expect, it, vi } from "vitest";
import {
    createTemplate,
    templatePath,
    templatesPath,
} from "../src/lib/api/templates";
import { jsonResponse, setupFetchStub } from "./helpers";

setupFetchStub();

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
            const path = templatesPath(undefined, "hot", 10);
            expect(
                new URL(path, "http://localhost").searchParams.get("limit"),
            ).toBe("10");
        });

        it("拼接 sort 参数", () => {
            const path = templatesPath(undefined, "latest");
            expect(
                new URL(path, "http://localhost").searchParams.get("sort"),
            ).toBe("latest");
        });

        it("同时拼接 category 和 limit", () => {
            const path = templatesPath("backend", "hot", 5);
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

    describe("createTemplate", () => {
        it("POST 到 /api/templates 并返回待审核模板", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse(
                    { ok: true, template: { id: "t1", status: "pending" } },
                    201,
                ),
            );
            const result = await createTemplate({
                title: "Python 小游戏",
                category: "game",
                tags: ["pygame"],
                files: [{ name: "main.py", content: "print(1)" }],
            });
            expect(result).toEqual({
                ok: true,
                template: { id: "t1", status: "pending" },
            });
            expect(fetch).toHaveBeenCalledWith(
                "/api/templates",
                expect.objectContaining({
                    method: "POST",
                    headers: expect.any(Object),
                    body: JSON.stringify({
                        title: "Python 小游戏",
                        category: "game",
                        tags: ["pygame"],
                        files: [{ name: "main.py", content: "print(1)" }],
                    }),
                }),
            );
        });

        it("失败时抛出服务端错误", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ error: "请至少添加一个模板文件" }, 400),
            );
            await expect(
                createTemplate({ title: "x", files: [] }),
            ).rejects.toThrow("请至少添加一个模板文件");
        });
    });
});
