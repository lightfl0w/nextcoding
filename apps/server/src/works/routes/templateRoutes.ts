import { Hono } from "hono";
import { checkAndUnlockAchievements } from "../../achievements/checker.js";
import { insertActivity } from "../../activities/repository.js";
import { type AuthenticatedEnv, requireSession } from "../../http/guards.js";
import { jsonError, readJsonBody, readTrimmed } from "../../http/responses.js";
import { getStorage } from "../../storage/storageClient.js";
import {
    createTemplate,
    deleteTemplateByWork,
    findTemplateByWork,
    setWorkIsTemplate,
} from "../../templates/repository.js";
import { useTemplateForUser } from "../../templates/service.js";
import { isBinaryPayload, toBase64, toText } from "../content.js";
import { requireWorkAuthor } from "../guards.js";
import { findWorkDetail, listWorkFiles } from "../repository.js";

export const workTemplateRoutes = new Hono<AuthenticatedEnv>();

/**
 * 一键使用模板：从作品的模板快照创建新草稿。
 * 等价于模板市场的「使用此模板」，但按作品定位模板。
 */
workTemplateRoutes.post("/:id/use-template", requireSession, async (c) => {
    const workId = c.req.param("id");
    const detail = await findWorkDetail(workId);
    if (detail?.status !== "published") {
        return jsonError(c, "作品不存在", 404);
    }
    if (!detail.isTemplate) {
        return jsonError(c, "该作品未开放为模板", 400);
    }

    const tpl = await findTemplateByWork(workId);
    if (!tpl) {
        return jsonError(c, "模板不存在", 404);
    }

    const result = await useTemplateForUser(tpl.id, c.get("userId"));
    return c.json(
        { id: result.id, title: result.title, files: result.files },
        201,
    );
});

/**
 * 把作品开放为模板：采集当前文件生成独立快照，注册为模板并上架。
 * 作者发起，自动生成动态并触发模板成就检查。
 */
workTemplateRoutes.post("/:id/template", requireWorkAuthor, async (c) => {
    const workId = c.req.param("id");
    const userId = c.get("userId");

    const existing = await findTemplateByWork(workId);
    if (existing) {
        return c.json({ ok: true, template: existing });
    }

    const files = await listWorkFiles(workId);
    if (files.length === 0) {
        return jsonError(c, "作品还没有文件，无法创建模板", 400);
    }

    const body = await readJsonBody(c);
    const detail = await findWorkDetail(workId);
    if (!detail) {
        return jsonError(c, "作品不存在", 404);
    }
    if (detail.status !== "published") {
        return jsonError(c, "请先发布作品再开放为模板", 400);
    }

    const title = readTrimmed(body, "title") || detail.title;
    const description = readTrimmed(body, "description") || detail.description;
    const category = readTrimmed(body, "category") || null;
    const coverUrl = readTrimmed(body, "coverUrl") || detail.coverUrl;

    const templateId = crypto.randomUUID();
    const snapshotKey = `templates/${templateId}/snapshot.json`;
    const snapshot = await buildTemplateSnapshot(workId);
    await getStorage().put(snapshotKey, toUtf8(JSON.stringify(snapshot)), {
        contentType: "application/json",
    });

    await createTemplate({
        id: templateId,
        authorId: userId,
        workId,
        title,
        description: description || null,
        category: category || null,
        tags: JSON.stringify(detail.tags),
        coverUrl,
        snapshotKey,
        fileCount: snapshot.files.length,
    });
    await setWorkIsTemplate(workId, true);
    await insertActivity({
        userId,
        type: "template",
        actorId: userId,
        workId,
    });
    void checkAndUnlockAchievements(userId).catch(() => {});

    return c.json(
        {
            ok: true,
            template: {
                id: templateId,
                title,
                description: description || null,
                category: category || null,
                fileCount: snapshot.files.length,
            },
        },
        201,
    );
});

/**
 * 关闭作品的模板开放状态，下架模板记录。
 */
workTemplateRoutes.delete("/:id/template", requireWorkAuthor, async (c) => {
    const workId = c.req.param("id");
    await deleteTemplateByWork(workId);
    await setWorkIsTemplate(workId, false);
    return c.json({ ok: true });
});

/**
 * 采集作品当前文件为内联快照（文本直接内联，二进制转 base64）。
 * @param workId - 作品 ID。
 */
async function buildTemplateSnapshot(workId: string) {
    const files = await listWorkFiles(workId);
    const storage = getStorage();
    const entries = await Promise.all(
        files.map(async (file) => {
            const raw = await storage.get(file.key);
            const bytes = raw ?? new Uint8Array(0);
            if (isBinaryPayload(file.contentType, bytes)) {
                return {
                    name: file.name,
                    contentType: file.contentType,
                    content: toBase64(bytes),
                    encoding: "base64" as const,
                };
            }
            return {
                name: file.name,
                contentType: file.contentType,
                content: toText(bytes),
            };
        }),
    );
    return {
        version: 1,
        createdAt: Date.now(),
        files: entries,
    };
}

function toUtf8(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}
