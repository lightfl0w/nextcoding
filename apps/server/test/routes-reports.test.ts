import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import * as reportRepo from "../src/reports/repository.js";
import { reportRoutes } from "../src/reports/routes.js";
import { mockGetSession } from "./setup";

function app() {
    return new Hono().route("/api/works", reportRoutes);
}

describe("POST /api/works/:id/report", () => {
    it("未登录返回 401", async () => {
        mockGetSession.mockResolvedValue(null);
        const res = await app().request("/api/works/w1/report", {
            method: "POST",
        });
        expect(res.status).toBe(401);
    });

    it("作品不存在返回 404", async () => {
        mockGetSession.mockResolvedValue({
            user: { id: "user-1", name: "张三", role: "user" },
            session: { id: "sess-1" },
        });
        vi.mocked(reportRepo.findReportableWork).mockResolvedValue(undefined);
        const res = await app().request("/api/works/w-missing/report", {
            method: "POST",
            body: JSON.stringify({ reason: "违规内容" }),
            headers: { "content-type": "application/json" },
        });
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "作品不存在" });
    });

    it("未填写原因返回 400", async () => {
        mockGetSession.mockResolvedValue({
            user: { id: "user-1", name: "张三", role: "user" },
            session: { id: "sess-1" },
        });
        vi.mocked(reportRepo.findReportableWork).mockResolvedValue({
            id: "w1",
        } as never);
        const res = await app().request("/api/works/w1/report", {
            method: "POST",
            body: JSON.stringify({ reason: "  " }),
            headers: { "content-type": "application/json" },
        });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "请填写举报原因" });
    });

    it("首次举报创建记录", async () => {
        mockGetSession.mockResolvedValue({
            user: { id: "user-1", name: "张三", role: "user" },
            session: { id: "sess-1" },
        });
        vi.mocked(reportRepo.findReportableWork).mockResolvedValue({
            id: "w1",
        } as never);
        vi.mocked(reportRepo.findReportByReporterAndWork).mockResolvedValue(
            undefined,
        );
        vi.mocked(reportRepo.insertReport).mockResolvedValue("r1");
        const res = await app().request("/api/works/w1/report", {
            method: "POST",
            body: JSON.stringify({ reason: "抄袭他人作品" }),
            headers: { "content-type": "application/json" },
        });
        expect(res.status).toBe(201);
        expect(reportRepo.insertReport).toHaveBeenCalledWith(
            "user-1",
            "w1",
            "抄袭他人作品",
        );
        expect(await res.json()).toEqual({
            ok: true,
            id: "r1",
            reReported: false,
        });
    });

    it("重复举报时重开既有记录", async () => {
        mockGetSession.mockResolvedValue({
            user: { id: "user-1", name: "张三", role: "user" },
            session: { id: "sess-1" },
        });
        vi.mocked(reportRepo.findReportableWork).mockResolvedValue({
            id: "w1",
        } as never);
        vi.mocked(reportRepo.findReportByReporterAndWork).mockResolvedValue({
            id: "r1",
            status: "resolved",
        } as never);
        const res = await app().request("/api/works/w1/report", {
            method: "POST",
            body: JSON.stringify({ reason: "再次举报" }),
            headers: { "content-type": "application/json" },
        });
        expect(res.status).toBe(200);
        expect(reportRepo.reopenReport).toHaveBeenCalledWith("r1", "再次举报");
        expect(reportRepo.insertReport).not.toHaveBeenCalled();
        expect(await res.json()).toEqual({
            ok: true,
            id: "r1",
            reReported: true,
        });
    });
});
