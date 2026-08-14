import { Hono } from "hono";
import { toWorkSummary } from "../works/serializers.js";
import {
    findTagBySlug,
    listPopularTags,
    listTags,
    listTagWorks,
} from "./repository.js";

export const tagRoutes = new Hono();

tagRoutes.get("/", async (c) => {
    const keyword = c.req.query("keyword");
    const sort = c.req.query("sort");
    const limitParam = c.req.query("limit");

    const sortBy = sort === "popular" ? "workCount" : "name";
    const limit = limitParam
        ? Math.min(Math.max(Number(limitParam), 1), 100)
        : undefined;

    const tags = await listTags(keyword, sortBy);
    const result = limit ? tags.slice(0, limit) : tags;

    return c.json(result);
});

tagRoutes.get("/popular", async (c) => {
    const limitParam = c.req.query("limit");
    const limit = limitParam
        ? Math.min(Math.max(Number(limitParam), 1), 50)
        : 20;

    const tags = await listPopularTags(limit);
    return c.json(tags);
});

tagRoutes.get("/:slug", async (c) => {
    const slug = c.req.param("slug");
    const tag = await findTagBySlug(slug);

    if (!tag) {
        return c.json({ error: "标签不存在" }, 404);
    }

    const sortParam = c.req.query("sort");
    const sort =
        sortParam === "popular"
            ? "popular"
            : sortParam === "weekly"
              ? "weekly"
              : "latest";
    const limitParam = c.req.query("limit");
    const limit = limitParam
        ? Math.min(Math.max(Number(limitParam), 1), 50)
        : 20;

    const works = await listTagWorks(tag.id, sort, limit);

    return c.json({ ...tag, works: works.map(toWorkSummary) });
});
