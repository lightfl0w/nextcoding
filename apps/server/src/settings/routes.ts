import { Hono } from "hono";
import { type AuthenticatedEnv, requireSession } from "../http/guards.js";
import { readJsonBody } from "../http/responses.js";
import { findOrCreateSettings, updateSettings } from "./repository.js";

export const settingsRoutes = new Hono<AuthenticatedEnv>();

settingsRoutes.get("/", requireSession, async (c) => {
    const settings = await findOrCreateSettings(c.get("userId"));
    return c.json(settings);
});

settingsRoutes.patch("/", requireSession, async (c) => {
    const body = await readJsonBody(c);

    const allowedKeys = [
        "notifyOnSpark",
        "notifyOnRemix",
        "notifyOnComment",
        "notifyOnFollow",
        "notifyOnMessage",
        "showActivity",
        "showBookmarks",
        "editorFontSize",
        "editorFontFamily",
        "editorTabSize",
    ] as const;

    const updates: Record<string, unknown> = {};
    for (const key of allowedKeys) {
        if (key in body) {
            updates[key] = body[key];
        }
    }

    if (Object.keys(updates).length === 0) {
        return c.json({ error: "没有可更新的字段" }, 400);
    }

    const settings = await updateSettings(c.get("userId"), updates);
    return c.json(settings);
});
