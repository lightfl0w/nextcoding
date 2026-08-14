import { Hono } from "hono";
import { type AuthenticatedEnv, requireSession } from "../http/guards.js";
import { jsonError } from "../http/responses.js";
import { getStorage } from "../storage/storageClient.js";
import { insertWork, insertWorkFiles } from "../works/repository.js";
import {
    bumpTemplateUseCount,
    findTemplate,
    listTemplates,
} from "./repository.js";

export const templateRoutes = new Hono<AuthenticatedEnv>();

templateRoutes.get("/", async (c) => {
    const category = c.req.query("category") || undefined;
    const rawLimit = Number(c.req.query("limit"));
    const limit =
        Number.isFinite(rawLimit) && rawLimit > 0
            ? Math.min(rawLimit, 100)
            : 50;

    const rows = await listTemplates(category, limit);
    return c.json(rows);
});

templateRoutes.get("/:id", async (c) => {
    const id = c.req.param("id");
    const row = await findTemplate(id);
    if (!row) {
        return jsonError(c, "模板不存在", 404);
    }
    return c.json(row);
});

templateRoutes.post("/:id/use", requireSession, async (c) => {
    const id = c.req.param("id");
    const tpl = await findTemplate(id);
    if (!tpl) {
        return jsonError(c, "模板不存在", 404);
    }

    const storage = getStorage();
    const raw = await storage.get(tpl.snapshotKey);
    if (!raw) {
        return jsonError(c, "模板数据不存在", 500);
    }

    let snapshot: {
        files?: Array<{
            name: string;
            content?: string;
            contentType?: string;
        }>;
    };
    try {
        const text = new TextDecoder().decode(raw);
        snapshot = JSON.parse(text);
    } catch {
        return jsonError(c, "模板数据格式错误", 500);
    }

    const files = snapshot.files ?? [];
    const workId = crypto.randomUUID();
    const userId = c.get("userId");

    await insertWork({
        id: workId,
        userId,
        title: tpl.title,
        description: tpl.description,
        tags: tpl.tags,
        status: "draft",
    });

    const workFiles = files.map((file) => {
        const key = `works/${workId}/files/${file.name}`;
        const content = file.content ?? "";
        const bytes = new TextEncoder().encode(content);
        return {
            key,
            name: file.name,
            size: bytes.length,
            contentType: file.contentType ?? null,
            bytes,
        };
    });

    await Promise.all(
        workFiles.map((f) =>
            storage.put(f.key, f.bytes, {
                contentType: f.contentType ?? undefined,
            }),
        ),
    );

    await insertWorkFiles(
        workFiles.map((f) => ({
            workId,
            key: f.key,
            name: f.name,
            size: f.size,
            contentType: f.contentType,
        })),
    );

    await bumpTemplateUseCount(id);

    return c.json(
        { id: workId, title: tpl.title, files: workFiles.length },
        201,
    );
});
