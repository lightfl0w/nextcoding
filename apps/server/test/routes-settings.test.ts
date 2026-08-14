import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import * as settingsRepo from "../src/settings/repository.js";
import { settingsRoutes } from "../src/settings/routes.js";
import { mockGetSession } from "./setup";

describe("settingsRoutes", () => {
    function app() {
        return new Hono().route("/api/settings", settingsRoutes);
    }

    function settingsRow(overrides: Record<string, unknown> = {}) {
        return {
            id: "s1",
            userId: "user-1",
            notifyOnSpark: true,
            notifyOnRemix: true,
            notifyOnComment: true,
            notifyOnFollow: true,
            notifyOnMessage: true,
            showActivity: true,
            showBookmarks: false,
            editorFontSize: 14,
            editorFontFamily: "monospace",
            editorTabSize: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...overrides,
        };
    }

    describe("GET /", () => {
        it("需要登录", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await app().request("/api/settings");
            expect(res.status).toBe(401);
        });

        it("返回当前用户设置", async () => {
            vi.mocked(settingsRepo.findOrCreateSettings).mockResolvedValue(
                settingsRow(),
            );
            const res = await app().request("/api/settings");
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body).toMatchObject({
                userId: "user-1",
                notifyOnSpark: true,
                editorFontSize: 14,
            });
            expect(settingsRepo.findOrCreateSettings).toHaveBeenCalledWith(
                "user-1",
            );
        });
    });

    describe("PATCH /", () => {
        it("需要登录", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await app().request("/api/settings", {
                method: "PATCH",
                body: JSON.stringify({ notifyOnSpark: false }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(401);
        });

        it("无有效字段返回 400", async () => {
            const res = await app().request("/api/settings", {
                method: "PATCH",
                body: JSON.stringify({ unknown: 1 }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "没有可更新的字段" });
        });

        it("更新通知偏好", async () => {
            vi.mocked(settingsRepo.updateSettings).mockResolvedValue(
                settingsRow({ notifyOnSpark: false }),
            );
            const res = await app().request("/api/settings", {
                method: "PATCH",
                body: JSON.stringify({ notifyOnSpark: false }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body).toMatchObject({ notifyOnSpark: false });
            expect(settingsRepo.updateSettings).toHaveBeenCalledWith("user-1", {
                notifyOnSpark: false,
            });
        });

        it("忽略非允许字段", async () => {
            vi.mocked(settingsRepo.updateSettings).mockResolvedValue(
                settingsRow(),
            );
            await app().request("/api/settings", {
                method: "PATCH",
                body: JSON.stringify({ notifyOnSpark: true, evil: "x" }),
                headers: { "content-type": "application/json" },
            });
            expect(settingsRepo.updateSettings).toHaveBeenCalledWith("user-1", {
                notifyOnSpark: true,
            });
        });
    });
});
