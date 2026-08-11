import { Hono } from "hono";
import { jsonError, readJsonBody, readTrimmed } from "../../http/responses.js";
import { getStorage } from "../../storage/storageClient.js";
import {
    type AuthenticatedEnv,
    readSession,
    requireSession,
    requireWorkAuthor,
} from "../guards.js";
import {
    exceedsFileSizeLimit,
    fileSizeLimitMessage,
    MY_WORKS_PAGE_SIZE,
    WORK_PAGE_SIZE_DEFAULT,
    WORK_PAGE_SIZE_MAX,
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
    updateWorkTitle,
    type WorkSort,
} from "../repository.js";
import { toOwnedWork, toWorkDetail, toWorkSummary } from "../serializers.js";

export const catalogRoutes = new Hono<AuthenticatedEnv>();

catalogRoutes.get("/", async (c) => {
    const raw = c.req.query("sort");
    const sort: WorkSort =
        raw === "popular" || raw === "weekly" ? raw : "latest";
    const limit = clampLimit(c.req.query("limit"));

    const session = await readSession(c);
    const userId = session?.user?.id ?? null;
    const rows = await listPublishedWorks(sort, limit, userId);
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
    const [detail, files] = await Promise.all([
        findWorkDetail(workId),
        listWorkFiles(workId),
    ]);
    if (!detail) return jsonError(c, "作品不存在", 404);

    return c.json(toWorkDetail(detail, files));
});

catalogRoutes.post("/", requireSession, async (c) => {
    const form = await c.req.parseBody();
    const title = String(form.title ?? "").trim();
    if (!title) return jsonError(c, "标题不能为空", 400);

    const uploads = collectUploads(form.files);
    const rejection = findRejectedUpload(uploads);
    if (rejection) return jsonError(c, rejection, 400);

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
    return c.json({ ok: true, id: workId, status: "published" });
});

catalogRoutes.patch("/:id", requireWorkAuthor, async (c) => {
    const body = await readJsonBody(c);
    const title = readTrimmed(body, "title");
    if (!title) return jsonError(c, "标题不能为空", 400);

    await updateWorkTitle(c.req.param("id"), title);
    return c.json({ id: c.req.param("id"), title });
});

function clampLimit(raw: string | undefined): number {
    const requested = Number(raw);
    if (!Number.isFinite(requested) || requested <= 0) {
        return WORK_PAGE_SIZE_DEFAULT;
    }
    return Math.min(requested, WORK_PAGE_SIZE_MAX);
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
