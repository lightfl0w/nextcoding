import { db, work } from "@nextcoding/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { checkAndUnlockAchievements } from "../../achievements/checker.js";
import { insertActivity } from "../../activities/repository.js";
import {
    type AuthenticatedEnv,
    readSession,
    requireSession,
} from "../../http/guards.js";
import { jsonError, readJsonBody, readTrimmed } from "../../http/responses.js";
import { getStorage } from "../../storage/storageClient.js";
import { syncWorkTags } from "../../tags/repository.js";
import { authorizeWorkRead, requireWorkAuthor } from "../guards.js";
import {
    clampLimit,
    exceedsFileSizeLimit,
    fileSizeLimitMessage,
    MY_WORKS_PAGE_SIZE,
} from "../limits.js";
import { fileStorageKey, isValidFileName } from "../naming.js";
import {
    findWorkDetail,
    insertWork,
    insertWorkFiles,
    listOwnedWorks,
    listPublishedWorks,
    listWorkFiles,
    publishWork,
    updateWorkCover,
    updateWorkDescription,
    updateWorkTags,
    updateWorkTitle,
    type WorkSort,
} from "../repository.js";
import { toOwnedWork, toWorkDetail, toWorkSummary } from "../serializers.js";
import { parseTags } from "../tags.js";

export const catalogRoutes = new Hono<AuthenticatedEnv>();

catalogRoutes.get("/", async (c) => {
    const raw = c.req.query("sort");
    const sort: WorkSort =
        raw === "popular" || raw === "weekly" ? raw : "latest";
    const limit = clampLimit(c.req.query("limit"));
    const keyword = (c.req.query("q") ?? "").trim().slice(0, 64) || undefined;

    const session = await readSession(c);
    const userId = session?.user?.id ?? null;
    const rows = await listPublishedWorks(sort, limit, userId, keyword);
    return c.json(
        rows.map((row) => ({
            ...toWorkSummary(row),
            sparked: Boolean(row.sparked),
        })),
    );
});

catalogRoutes.get("/mine", requireSession, async (c) => {
    const rows = await listOwnedWorks(c.get("userId"), MY_WORKS_PAGE_SIZE);
    return c.json(rows.map(toOwnedWork));
});

catalogRoutes.get("/:id", async (c) => {
    const workId = c.req.param("id");
    const access = await authorizeWorkRead(c, workId);
    if (!access.ok) {
        return jsonError(c, "作品不存在", 404);
    }

    const [detail, files] = await Promise.all([
        findWorkDetail(workId, access.viewerId),
        listWorkFiles(workId),
    ]);
    if (!detail) {
        return jsonError(c, "作品不存在", 404);
    }

    return c.json(toWorkDetail(detail, files));
});

catalogRoutes.post("/", requireSession, async (c) => {
    const form = await c.req.parseBody();
    const title = String(form.title ?? "").trim();
    if (!title) {
        return jsonError(c, "标题不能为空", 400);
    }

    const uploads = collectUploads(form.files);
    const rejection = findRejectedUpload(uploads);
    if (rejection) {
        return jsonError(c, rejection, 400);
    }

    const workId = crypto.randomUUID();
    await insertWork({
        id: workId,
        userId: c.get("userId"),
        title,
        description: form.description ? String(form.description) : null,
        tags: form.tags ? String(form.tags) : "[]",
        status: "draft",
    });

    const storage = getStorage();
    await Promise.all(
        uploads.map((file) =>
            storage.put(fileStorageKey(workId, file.name), file, {
                contentType: file.type || undefined,
            }),
        ),
    );
    await insertWorkFiles(
        uploads.map((file) => ({
            workId,
            key: fileStorageKey(workId, file.name),
            name: file.name,
            size: file.size,
            contentType: file.type || null,
        })),
    );

    return c.json({ id: workId, title, files: uploads.length }, 201);
});

const WORK_COVER_ALLOWED = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
]);
const WORK_COVER_MAX = 5 * 1024 * 1024;
const WORK_COVER_EXT: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
};

function workCoverKey(userId: string, ext: string): string {
    const id = crypto.randomUUID().replace(/-/g, "");
    return `work-covers/${userId}/${id}.${ext}`;
}

function workCoverUrl(key: string): string {
    return `/api/storage/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * 上传作品封面（裁剪后的图片或运行截图），返回公开访问地址。
 * Body: multipart/form-data，字段 file 为图片文件。
 */
catalogRoutes.post("/cover", requireSession, async (c) => {
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
    if (!WORK_COVER_ALLOWED.has(file.type)) {
        return jsonError(
            c,
            "不支持的图片格式，仅允许 JPG、PNG、WebP、GIF",
            400,
        );
    }
    if (file.size > WORK_COVER_MAX) {
        return jsonError(c, "封面图片过大，不能超过 5 MB", 400);
    }

    const ext = WORK_COVER_EXT[file.type];
    const key = workCoverKey(userId, ext);
    await getStorage().put(key, file, { contentType: file.type });

    return c.json({ key, url: workCoverUrl(key) }, 201);
});

catalogRoutes.post("/:id/publish", requireWorkAuthor, async (c) => {
    const workId = c.req.param("id");
    const files = await listWorkFiles(workId);
    if (files.length === 0) {
        return jsonError(c, "发布前请至少创建一个文件", 400);
    }
    if (!files.some((file) => file.size > 0)) {
        return jsonError(c, "请至少在一个文件里填写内容后再发布", 400);
    }
    await publishWork(workId);
    const userId = c.get("userId");

    const [workRow] = await db
        .select({ tags: work.tags })
        .from(work)
        .where(eq(work.id, workId))
        .limit(1);
    if (workRow) {
        await syncWorkTags(workId, parseTags(workRow.tags));
    }
    await insertActivity({
        userId,
        type: "publish",
        actorId: userId,
        workId,
    });
    void checkAndUnlockAchievements(userId).catch(() => {});
    return c.json({ ok: true, id: workId, status: "published" });
});

catalogRoutes.patch("/:id", requireWorkAuthor, async (c) => {
    const body = await readJsonBody(c);
    const id = c.req.param("id");

    let title: string | undefined;
    if (body.title !== undefined) {
        title = readTrimmed(body, "title");
        if (!title) {
            return jsonError(c, "标题不能为空", 400);
        }
        await updateWorkTitle(id, title);
    }

    if ("description" in body) {
        const description =
            typeof body.description === "string" ? body.description : null;
        await updateWorkDescription(id, description);
    }

    if ("tags" in body) {
        const tags = readTags(body.tags);
        await updateWorkTags(id, tags);
        await syncWorkTags(id, tags);
    }

    if ("coverUrl" in body) {
        const coverUrl =
            typeof body.coverUrl === "string" ? body.coverUrl : null;
        await updateWorkCover(id, coverUrl);
    }

    return c.json(title !== undefined ? { id, title } : { id });
});

/**
 * 规范化标签列表：仅保留合法字符串，去重、去空并截断到 20 个。
 * @param raw - 原始标签值。
 */
function readTags(raw: unknown): string[] {
    const items = Array.isArray(raw) ? raw : [];
    const unique = new Set<string>();
    for (const item of items) {
        if (typeof item !== "string") {
            continue;
        }
        const tag = item.trim().slice(0, 32);
        if (tag) {
            unique.add(tag);
        }
        if (unique.size >= 20) {
            break;
        }
    }
    return [...unique];
}

function collectUploads(field: unknown): File[] {
    const candidates = Array.isArray(field) ? field : field ? [field] : [];
    return candidates.filter((item): item is File => item instanceof File);
}

function findRejectedUpload(files: File[]): string | null {
    for (const file of files) {
        if (exceedsFileSizeLimit(file.size)) {
            return fileSizeLimitMessage(file.name);
        }
        if (!isValidFileName(file.name)) {
            return `文件名不合法: ${file.name}`;
        }
    }
    return null;
}
