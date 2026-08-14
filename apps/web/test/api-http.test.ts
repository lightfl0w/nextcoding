import { describe, expect, it, vi } from "vitest";
import {
    getJson,
    getTextOrEmpty,
    HttpError,
    mutateJson,
    postForm,
    sendJson,
} from "../src/lib/api/http";
import { jsonResponse, setupFetchStub } from "./helpers";

setupFetchStub();

describe("api/http", () => {
    describe("HttpError", () => {
        it("携带状态码与动作信息", () => {
            const err = new HttpError(404, "加载失败");
            expect(err).toBeInstanceOf(Error);
            expect(err.status).toBe(404);
            expect(err.message).toBe("加载失败: 404");
            expect(err.name).toBe("HttpError");
        });

        it("默认动作文案为请求失败", () => {
            expect(new HttpError(500).message).toBe("请求失败: 500");
        });
    });

    describe("sendJson", () => {
        it("无 body 时不带请求体", async () => {
            const mockFetch = vi.mocked(fetch);
            mockFetch.mockResolvedValue(new Response(null));
            await sendJson("/api/x", "POST");
            expect(mockFetch).toHaveBeenCalledWith("/api/x", {
                method: "POST",
            });
        });

        it("带 body 时序列化 JSON 并设置请求头", async () => {
            const mockFetch = vi.mocked(fetch);
            mockFetch.mockResolvedValue(new Response(null));
            await sendJson("/api/x", "PUT", { a: 1 });
            expect(mockFetch).toHaveBeenCalledWith("/api/x", {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ a: 1 }),
            });
        });
    });

    describe("getJson", () => {
        it("成功解析 JSON", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }));
            await expect(getJson<{ ok: boolean }>("/api/x")).resolves.toEqual({
                ok: true,
            });
        });

        it("非 2xx 抛出 HttpError", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ error: "x" }, 500),
            );
            await expect(getJson("/api/x")).rejects.toThrow("请求失败: 500");
        });
    });

    describe("getTextOrEmpty", () => {
        it("成功返回文本", async () => {
            vi.mocked(fetch).mockResolvedValue(new Response("hi"));
            await expect(getTextOrEmpty("/api/x")).resolves.toBe("hi");
        });

        it("失败返回空串", async () => {
            vi.mocked(fetch).mockResolvedValue(
                new Response("err", { status: 404 }),
            );
            await expect(getTextOrEmpty("/api/x")).resolves.toBe("");
        });
    });

    describe("mutateJson", () => {
        it("成功解析并透传数据", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({ id: 1 }));
            await expect(
                mutateJson("/api/x", "PATCH", { t: 1 }, "保存"),
            ).resolves.toEqual({ id: 1 });
        });

        it("失败抛出带动作的 HttpError", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 400));
            await expect(
                mutateJson("/api/x", "POST", undefined, "保存"),
            ).rejects.toMatchObject({ status: 400, message: "保存: 400" });
        });
    });

    describe("postForm", () => {
        it("POST FormData", async () => {
            const form = new FormData();
            const mockFetch = vi.mocked(fetch);
            mockFetch.mockResolvedValue(new Response(null));
            await postForm("/api/x", form);
            expect(mockFetch).toHaveBeenCalledWith("/api/x", {
                method: "POST",
                body: form,
            });
        });
    });
});
