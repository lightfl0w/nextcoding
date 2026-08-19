import { type Context, Hono } from "hono";
import { checkAndUnlockAchievements } from "../achievements/checker.js";
import { insertActivity } from "../activities/repository.js";
import {
    type AuthenticatedEnv,
    readSession,
    requireSession,
} from "../http/guards.js";
import { jsonError, readJsonBody, readTrimmed } from "../http/responses.js";
import { getStorage } from "../storage/storageClient.js";
import {
    decodePayload,
    isBinaryPayload,
    toBase64,
    toText,
} from "../works/content.js";
import {
    COMMENT_MAX_LENGTH,
    COMMENT_PAGE_SIZE,
    exceedsFileSizeLimit,
    fileSizeLimitMessage,
} from "../works/limits.js";
import { isValidFileName } from "../works/naming.js";
import { toComment } from "../works/serializers.js";
import type { TemplateSort } from "./repository.js";
import {
    countTemplateUses,
    createTemplate,
    findTemplate,
    findTemplateComment,
    findTemplateDetail,
    insertTemplateComment,
    listTemplateComments,
    listTemplateLeaderboard,
    listTemplates,
    listTemplateUses,
    rateTemplate,
    sumTemplateDerivedStats,
} from "./repository.js";
import { useTemplateForUser } from "./service.js";

export const templateRoutes = new Hono<AuthenticatedEnv>();

const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
]);

const MAX_COVER_SIZE = 5 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
};

function coverStorageKey(userId: string, ext: string): string {
    const id = crypto.randomUUID().replace(/-/g, "");
    return `template-covers/${userId}/${id}.${ext}`;
}

function publicStorageUrl(key: string): string {
    return `/api/storage/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * 上传模板封面（裁剪后的图片），返回公开访问地址。
 * Body: multipart/form-data，字段 file 为图片文件。
 */
templateRoutes.post("/cover", requireSession, async (c) => {
    const userId = c.get("userId");
    let form: FormData;
    try {
        form = await c.req.formData();
    } catch {
        return jsonError(c, "无效的表单数据", 400);
    }

    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) {
        return jsonError(c, "请选择上传的封面图片", 400);
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        return jsonError(
            c,
            "不支持的图片格式，仅允许 JPG、PNG、WebP、GIF",
            400,
        );
    }
    if (file.size > MAX_COVER_SIZE) {
        return jsonError(c, "封面图片过大，不能超过 5 MB", 400);
    }

    const ext = EXT_BY_MIME[file.type];
    const key = coverStorageKey(userId, ext);
    await getStorage().put(key, file, { contentType: file.type });

    return c.json({ key, url: publicStorageUrl(key) }, 201);
});

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

/**
 * 创建全新模板（作者直接提交，进入待审核状态）。
 * Body: { title, description?, category?, tags?, coverUrl?, files: [{ name, contentType?, content, isBase64? }] }
 */
templateRoutes.post("/", requireSession, async (c) => {
    const userId = c.get("userId");
    const body = await readJsonBody(c);

    const title = readTrimmed(body, "title");
    if (!title) {
        return jsonError(c, "模板标题不能为空", 400);
    }

    const coverUrl = readTrimmed(body, "coverUrl");
    if (!coverUrl) {
        return jsonError(c, "请上传模板封面", 400);
    }

    const rawFiles = Array.isArray(body.files) ? body.files : [];
    if (rawFiles.length === 0) {
        return jsonError(c, "请至少添加一个模板文件", 400);
    }

    const files: Array<{
        name: string;
        contentType: string | null;
        content: string;
        encoding?: "base64";
    }> = [];
    for (const raw of rawFiles) {
        if (typeof raw !== "object" || raw === null) {
            return jsonError(c, "模板文件格式不合法", 400);
        }
        const name = readTrimmed(raw, "name");
        if (!name || !isValidFileName(name)) {
            return jsonError(c, "模板文件名不合法", 400);
        }
        const content = typeof raw.content === "string" ? raw.content : "";
        const decoded = decodePayload(content, raw.isBase64 === true);
        if (!decoded.ok) {
            return jsonError(c, decoded.reason ?? "模板文件内容不合法", 400);
        }
        if (exceedsFileSizeLimit(decoded.bytes.length)) {
            return jsonError(c, fileSizeLimitMessage(name), 400);
        }
        const contentType =
            typeof raw.contentType === "string" && raw.contentType
                ? raw.contentType
                : null;
        files.push(
            isBinaryPayload(contentType, decoded.bytes)
                ? {
                      name,
                      contentType,
                      content: toBase64(decoded.bytes),
                      encoding: "base64",
                  }
                : { name, contentType, content: toText(decoded.bytes) },
        );
    }

    const templateId = crypto.randomUUID();
    const snapshotKey = `templates/${templateId}/snapshot.json`;
    const snapshot = { version: 1, createdAt: Date.now(), files };
    await getStorage().put(snapshotKey, toUtf8(JSON.stringify(snapshot)), {
        contentType: "application/json",
    });

    const tags = Array.isArray(body.tags)
        ? body.tags
              .filter((tag): tag is string => typeof tag === "string")
              .slice(0, 20)
        : [];
    await createTemplate({
        id: templateId,
        authorId: userId,
        workId: null,
        title,
        description: readTrimmed(body, "description") || null,
        category: readTrimmed(body, "category") || null,
        tags: JSON.stringify(tags),
        coverUrl,
        snapshotKey,
        fileCount: files.length,
        status: "pending",
    });
    await insertActivity({
        userId,
        type: "template",
        actorId: userId,
        workId: null,
    });
    void checkAndUnlockAchievements(userId).catch(() => {});

    return c.json(
        { ok: true, template: { id: templateId, status: "pending" } },
        201,
    );
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
    if (row.status !== "published" && !(await canReviewTemplate(c, row))) {
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
    if (tpl.status !== "published") {
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

templateRoutes.get("/:id/comments", async (c) => {
    const id = c.req.param("id");
    const tpl = await findTemplate(id);
    if (!tpl) {
        return jsonError(c, "模板不存在", 404);
    }
    if (tpl.status !== "published" && !(await canReviewTemplate(c, tpl))) {
        return jsonError(c, "模板不存在", 404);
    }
    const rows = await listTemplateComments(id, COMMENT_PAGE_SIZE);
    return c.json(rows.map(toComment));
});

templateRoutes.post("/:id/comments", requireSession, async (c) => {
    const id = c.req.param("id");
    const [body, tpl] = await Promise.all([
        readJsonBody(c),
        findTemplate(id),
    ]);
    if (!tpl) {
        return jsonError(c, "模板不存在", 404);
    }
    if (tpl.status !== "published") {
        return jsonError(c, "模板不存在", 404);
    }

    const content = readTrimmed(body, "content");
    if (!content) {
        return jsonError(c, "评论内容不能为空", 400);
    }
    if (content.length > COMMENT_MAX_LENGTH) {
        return jsonError(c, `评论最多 ${COMMENT_MAX_LENGTH} 字`, 400);
    }

    const parentId =
        typeof body.parentId === "string" && body.parentId ? body.parentId : null;
    if (parentId) {
        const parent = await findTemplateComment(parentId);
        if (!parent || parent.templateId !== id) {
            return jsonError(c, "父评论不存在", 400);
        }
    }

    const userId = c.get("userId");
    const inserted = await insertTemplateComment({
        templateId: id,
        userId,
        parentId,
        content,
    });

    return c.json(
        {
            id: inserted.id,
            content,
            parentId,
            createdAt: inserted.createdAt,
            author: { id: userId, name: c.get("userName") },
        },
        201,
    );
});

templateRoutes.get("/:id/uses", async (c) => {
    const id = c.req.param("id");
    const tpl = await findTemplate(id);
    if (!tpl) {
        return jsonError(c, "模板不存在", 404);
    }
    if (tpl.status !== "published" && !(await canReviewTemplate(c, tpl))) {
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
    if (tpl.status !== "published" && !(await canReviewTemplate(c, tpl))) {
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

function toUtf8(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}

/**
 * 非上架模板的可见性：仅模板作者与管理员可访问。
 * @param c - 请求上下文。
 * @param template - 模板行（含 authorId）。
 */
async function canReviewTemplate(
    c: Context,
    template: { authorId: string | null },
) {
    const session = await readSession(c);
    if (!session?.user) {
        return false;
    }
    return (
        session.user.role === "admin" || session.user.id === template.authorId
    );
}
