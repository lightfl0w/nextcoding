import { Hono } from "hono";
import { type AuthenticatedEnv, requireSession } from "../http/guards.js";
import { jsonError, readJsonBody } from "../http/responses.js";
import type { TemplateSort } from "./repository.js";
import {
    countTemplateUses,
    findTemplate,
    findTemplateDetail,
    listTemplateLeaderboard,
    listTemplates,
    listTemplateUses,
    rateTemplate,
    sumTemplateDerivedStats,
} from "./repository.js";
import { useTemplateForUser } from "./service.js";

export const templateRoutes = new Hono<AuthenticatedEnv>();

templateRoutes.get("/", async (c) => {
    const category = c.req.query("category") || undefined;
    const sort = parseSort(c.req.query("sort"));
    const rawLimit = Number(c.req.query("limit"));
    const limit =
        Number.isFinite(rawLimit) && rawLimit > 0
            ? Math.min(rawLimit, 100)
            : 50;

    const rows = await listTemplates(category, sort, limit);
    return c.json(rows);
});

templateRoutes.get("/leaderboard", async (c) => {
    const rawLimit = Number(c.req.query("limit"));
    const limit =
        Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 20) : 10;
    return c.json(await listTemplateLeaderboard(limit));
});

templateRoutes.get("/:id", async (c) => {
    const id = c.req.param("id");
    const row = await findTemplateDetail(id);
    if (!row) {
        return jsonError(c, "模板不存在", 404);
    }
    return c.json(row);
});

templateRoutes.post("/:id/use", requireSession, async (c) => {
    try {
        const result = await useTemplateForUser(
            c.req.param("id"),
            c.get("userId"),
        );
        return c.json(
            { id: result.id, title: result.title, files: result.files },
            201,
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : "模板使用失败";
        if (message === "模板不存在") {
            return jsonError(c, message, 404);
        }
        return jsonError(c, message, 500);
    }
});

templateRoutes.post("/:id/rate", requireSession, async (c) => {
    const id = c.req.param("id");
    const tpl = await findTemplate(id);
    if (!tpl) {
        return jsonError(c, "模板不存在", 404);
    }

    const body = await readJsonBody(c);
    const rawScore = body.score;
    if (typeof rawScore !== "number" || !Number.isInteger(rawScore)) {
        return jsonError(c, "评分必须是整数", 400);
    }
    if (rawScore < 1 || rawScore > 5) {
        return jsonError(c, "评分范围是 1-5", 400);
    }

    await rateTemplate(id, rawScore);
    return c.json({ ok: true, score: rawScore });
});

templateRoutes.get("/:id/uses", async (c) => {
    const id = c.req.param("id");
    const tpl = await findTemplate(id);
    if (!tpl) {
        return jsonError(c, "模板不存在", 404);
    }
    const rawLimit = Number(c.req.query("limit"));
    const limit =
        Number.isFinite(rawLimit) && rawLimit > 0
            ? Math.min(rawLimit, 100)
            : 50;
    return c.json(await listTemplateUses(id, limit));
});

templateRoutes.get("/:id/tree", async (c) => {
    const id = c.req.param("id");
    const tpl = await findTemplateDetail(id);
    if (!tpl) {
        return jsonError(c, "模板不存在", 404);
    }
    const derived = await listTemplateUses(id, 100);
    return c.json({ template: tpl, derived });
});

templateRoutes.get("/:id/stats", requireSession, async (c) => {
    const id = c.req.param("id");
    const tpl = await findTemplate(id);
    if (!tpl) {
        return jsonError(c, "模板不存在", 404);
    }
    const userId = c.get("userId");
    if (!tpl.authorId || tpl.authorId !== userId) {
        return jsonError(c, "仅模板作者可查看数据面板", 403);
    }

    const [uses, totalUses, stats] = await Promise.all([
        listTemplateUses(id, 100),
        countTemplateUses(id),
        sumTemplateDerivedStats(id),
    ]);

    return c.json({
        template: {
            id: tpl.id,
            title: tpl.title,
            useCount: tpl.useCount,
            rating: tpl.rating,
            ratingCount: tpl.ratingCount,
        },
        uses,
        totalUses,
        stats,
    });
});

function parseSort(raw: string | undefined): TemplateSort {
    return raw === "latest" ? "latest" : "hot";
}
