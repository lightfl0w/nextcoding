import { Hono } from "hono";
import { jsonError, readJsonBody, readTrimmed } from "../http/responses.js";
import {
    readSession,
    requireSession,
    type AuthenticatedEnv,
} from "../http/guards.js";
import { getStorage } from "../storage/storageClient.js";
import {
    createChapter,
    createNovel,
    deleteChapter,
    deleteNovel,
    findChapter,
    findNovel,
    listChapters,
    listNovels,
    publishNovel,
    unpublishNovel,
    updateChapter,
    updateNovel,
} from "./repository.js";

export const novelRoutes = new Hono<AuthenticatedEnv>();

novelRoutes.get("/", async (c) => {
    // 未登录也能看列表，但只返回已发布的小说；登录后额外显示自己的草稿。
    const session = await readSession(c);
    return c.json(await listNovels(session?.user?.id));
});

novelRoutes.post("/", requireSession, async (c) => {
    const userId = c.get("userId");
    const body = await readJsonBody(c);
    const title = readTrimmed(body, "title");
    if (!title) {
        return jsonError(c, "小说标题不能为空", 400);
    }
    const id = crypto.randomUUID();
    await createNovel({
        id,
        userId,
        title,
        description: readTrimmed(body, "description") || null,
    });
    return c.json({ ok: true, id }, 201);
});

const NOVEL_COVER_ALLOWED = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
]);
const NOVEL_COVER_MAX = 5 * 1024 * 1024;
const NOVEL_COVER_EXT: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
};

function novelCoverKey(userId: string, ext: string): string {
    const id = crypto.randomUUID().replace(/-/g, "");
    return `novel-covers/${userId}/${id}.${ext}`;
}

function novelCoverUrl(key: string): string {
    return `/api/storage/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * 上传小说封面（裁剪后的图片），返回公开访问地址。
 * Body: multipart/form-data，字段 file 为图片文件。
 */
novelRoutes.post("/cover", requireSession, async (c) => {
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
    if (!NOVEL_COVER_ALLOWED.has(file.type)) {
        return jsonError(
            c,
            "不支持的图片格式，仅允许 JPG、PNG、WebP、GIF",
            400,
        );
    }
    if (file.size > NOVEL_COVER_MAX) {
        return jsonError(c, "封面图片过大，不能超过 5 MB", 400);
    }

    const ext = NOVEL_COVER_EXT[file.type];
    const key = novelCoverKey(userId, ext);
    await getStorage().put(key, file, { contentType: file.type });

    return c.json({ key, url: novelCoverUrl(key) }, 201);
});

novelRoutes.get("/:id", async (c) => {
    const id = c.req.param("id");
    // 草稿仅作者可见；非作者访问未发布小说返回 404。
    const session = await readSession(c);
    const row = await findNovel(id, session?.user?.id);
    if (!row) {
        return jsonError(c, "小说不存在", 404);
    }
    return c.json(row);
});

novelRoutes.patch("/:id", requireSession, async (c) => {
    const id = c.req.param("id");
    const userId = c.get("userId");
    const row = await findNovel(id, userId);
    if (!row) {
        return jsonError(c, "小说不存在", 404);
    }
    if (row.authorId !== userId) {
        return jsonError(c, "无权修改该小说", 403);
    }
    const body = await readJsonBody(c);
    const title = readTrimmed(body, "title");
    if (!title) {
        return jsonError(c, "小说标题不能为空", 400);
    }
    const patch: {
        title: string;
        description: string | null;
        coverUrl?: string | null;
    } = {
        title,
        description: readTrimmed(body, "description") || null,
    };
    if (typeof body.coverUrl === "string") {
        patch.coverUrl = body.coverUrl;
    }
    await updateNovel(id, patch);
    return c.json({ ok: true });
});

novelRoutes.post("/:id/publish", requireSession, async (c) => {
    const id = c.req.param("id");
    const userId = c.get("userId");
    const row = await findNovel(id, userId);
    if (!row) {
        return jsonError(c, "小说不存在", 404);
    }
    if (row.authorId !== userId) {
        return jsonError(c, "无权发布该小说", 403);
    }
    const body = await readJsonBody(c);
    const title = readTrimmed(body, "title");
    if (!title) {
        return jsonError(c, "小说标题不能为空", 400);
    }
    await publishNovel(id, {
        title,
        description: readTrimmed(body, "description") || null,
        coverUrl: typeof body.coverUrl === "string" ? body.coverUrl : null,
    });
    return c.json({ ok: true });
});

novelRoutes.post("/:id/unpublish", requireSession, async (c) => {
    const id = c.req.param("id");
    const userId = c.get("userId");
    const row = await findNovel(id, userId);
    if (!row) {
        return jsonError(c, "小说不存在", 404);
    }
    if (row.authorId !== userId) {
        return jsonError(c, "无权操作该小说", 403);
    }
    await unpublishNovel(id);
    return c.json({ ok: true });
});

novelRoutes.delete("/:id", requireSession, async (c) => {
    const id = c.req.param("id");
    const row = await findNovel(id, c.get("userId"));
    if (!row) {
        return jsonError(c, "小说不存在", 404);
    }
    if (row.authorId !== c.get("userId")) {
        return jsonError(c, "无权删除该小说", 403);
    }
    await deleteNovel(id);
    return c.json({ ok: true });
});

novelRoutes.get("/:id/chapters", async (c) => {
    const id = c.req.param("id");
    const session = await readSession(c);
    const row = await findNovel(id, session?.user?.id);
    if (!row) {
        return jsonError(c, "小说不存在", 404);
    }
    return c.json(await listChapters(id));
});

novelRoutes.post("/:id/chapters", requireSession, async (c) => {
    const id = c.req.param("id");
    const row = await findNovel(id, c.get("userId"));
    if (!row) {
        return jsonError(c, "小说不存在", 404);
    }
    if (row.authorId !== c.get("userId")) {
        return jsonError(c, "无权修改该小说", 403);
    }
    const body = await readJsonBody(c);
    const title = readTrimmed(body, "title");
    if (!title) {
        return jsonError(c, "章节标题不能为空", 400);
    }
    const inserted = await createChapter({ novelId: id, title });
    return c.json({ ok: true, chapter: inserted }, 201);
});

novelRoutes.get("/:id/chapters/:chapterId", async (c) => {
    const id = c.req.param("id");
    const chapterId = c.req.param("chapterId");
    const session = await readSession(c);
    const novelRow = await findNovel(id, session?.user?.id);
    if (!novelRow) {
        return jsonError(c, "小说不存在", 404);
    }
    const row = await findChapter(id, chapterId);
    if (!row) {
        return jsonError(c, "章节不存在", 404);
    }
    return c.json(row);
});

novelRoutes.patch(
    "/:id/chapters/:chapterId",
    requireSession,
    async (c) => {
        const id = c.req.param("id");
        const chapterId = c.req.param("chapterId");
        const row = await findNovel(id, c.get("userId"));
        if (!row) {
            return jsonError(c, "小说不存在", 404);
        }
        if (row.authorId !== c.get("userId")) {
            return jsonError(c, "无权修改该小说", 403);
        }
        const existing = await findChapter(id, chapterId);
        if (!existing) {
            return jsonError(c, "章节不存在", 404);
        }
        const body = await readJsonBody(c);
        const title = readTrimmed(body, "title");
        if (!title) {
            return jsonError(c, "章节标题不能为空", 400);
        }
        const content =
            typeof body.content === "string" ? body.content : existing.content;
        await updateChapter(chapterId, { title, content });
        return c.json({ ok: true });
    },
);

novelRoutes.delete(
    "/:id/chapters/:chapterId",
    requireSession,
    async (c) => {
        const id = c.req.param("id");
        const chapterId = c.req.param("chapterId");
        const row = await findNovel(id, c.get("userId"));
        if (!row) {
            return jsonError(c, "小说不存在", 404);
        }
        if (row.authorId !== c.get("userId")) {
            return jsonError(c, "无权删除该小说", 403);
        }
        const existing = await findChapter(id, chapterId);
        if (!existing) {
            return jsonError(c, "章节不存在", 404);
        }
        await deleteChapter(id, chapterId);
        return c.json({ ok: true });
    },
);
