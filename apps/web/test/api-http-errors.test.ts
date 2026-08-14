import { describe, expect, it } from "vitest";
import { HttpError } from "../src/lib/api/http";

describe("HttpError", () => {
    it("存储状态码", () => {
        const err = new HttpError(404, "未找到");
        expect(err.status).toBe(404);
    });

    it("无 message 时默认为请求失败: status", () => {
        const err = new HttpError(500);
        expect(err.message).toBe("请求失败: 500");
    });

    it("有 message 时使用提供的消息", () => {
        const err = new HttpError(400, "保存失败");
        expect(err.message).toBe("保存失败");
    });

    it("是 Error 的实例", () => {
        const err = new HttpError(403);
        expect(err).toBeInstanceOf(Error);
    });

    it("name 属性为 HttpError", () => {
        const err = new HttpError(500);
        expect(err.name).toBe("HttpError");
    });

    it("不同状态码独立存储", () => {
        expect(new HttpError(401).status).toBe(401);
        expect(new HttpError(403).status).toBe(403);
        expect(new HttpError(404).status).toBe(404);
    });
});
