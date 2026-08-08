import { auth } from "@nextcoding/auth";
import { db, user, work, workFile, workVersion } from "@nextcoding/db";
import { createStorage } from "@nextcoding/storage";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";

export const works = new Hono();

interface SnapshotFile {
    key: string;
    name: string;
    contentType: string | null;
    content: string;
}

interface Snapshot {
    version: number;
    message: string | null;
    createdAt: number;
    files: SnapshotFile[];
}

type AuthResult =
    | { session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>> }
    | { error: string; status: 401 | 403 | 404 };

async function requireAuthor(c: Context, workId: string): Promise<AuthResult> {
    const session = await auth.api.getSession({
        headers: c.req.raw.headers,
    });
    if (!session?.user) return { error: "未登录", status: 401 };

    const [row] = await db
        .select({ userId: work.userId })
        .from(work)
        .where(eq(work.id, workId));
    if (!row) return { error: "作品不存在", status: 404 };
    if (row.userId !== session.user.id) {
        return { error: "无权操作", status: 403 };
    }
    return { session };
}

async function readJson(c: Context): Promise<Record<string, unknown> | null> {
    try {
        return (await c.req.json()) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function jsonError(
    c: Context,
    message: string,
    status: 400 | 401 | 403 | 404 | 409 | 500,
) {
    return c.json({ error: message }, status);
}

works.get("/", async (c) => {
    const sort = c.req.query("sort") === "popular" ? "popular" : "latest";
    const limit = Math.min(Number(c.req.query("limit") ?? 20) || 20, 100);

    const orderBy =
        sort === "popular"
            ? [desc(work.likes), desc(work.views), desc(work.createdAt)]
            : [desc(work.createdAt)];

    const rows = await db
        .select({
            id: work.id,
            title: work.title,
            description: work.description,
            coverUrl: work.coverUrl,
            tags: work.tags,
            views: work.views,
            likes: work.likes,
            createdAt: work.createdAt,
            authorId: user.id,
            authorName: user.name,
        })
        .from(work)
        .leftJoin(user, eq(work.userId, user.id))
        .where(eq(work.status, "published"))
        .orderBy(...orderBy)
        .limit(limit);

    return c.json(
        rows.map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description,
            coverUrl: row.coverUrl,
            tags: parseTags(row.tags),
            views: row.views,
            likes: row.likes,
            createdAt: row.createdAt,
            author: { id: row.authorId, name: row.authorName },
        })),
    );
});

works.get("/:id", async (c) => {
    const id = c.req.param("id");

    const [row] = await db.select().from(work).where(eq(work.id, id));
    if (!row) return jsonError(c, "作品不存在", 404);

    const files = await db
        .select()
        .from(workFile)
        .where(eq(workFile.workId, id));

    return c.json({ ...row, tags: parseTags(row.tags), files });
});

works.get("/:id/files", async (c) => {
    const id = c.req.param("id");

    const [row] = await db.select().from(work).where(eq(work.id, id));
    if (!row) return jsonError(c, "作品不存在", 404);

    const files = await db
        .select()
        .from(workFile)
        .where(eq(workFile.workId, id));

    return c.json({ files });
});

works.get("/:id/files/content", async (c) => {
    const id = c.req.param("id");
    const key = c.req.query("key");
    if (!key) return jsonError(c, "缺少 key", 400);

    const [file] = await db
        .select()
        .from(workFile)
        .where(and(eq(workFile.workId, id), eq(workFile.key, key)))
        .limit(1);
    if (!file) return jsonError(c, "文件不存在", 404);

    const storage = createStorage();
    const data = await storage.get(file.key);
    if (!data) return jsonError(c, "内容缺失", 404);

    return c.text(new TextDecoder().decode(data));
});

works.post("/:id/files", async (c) => {
    const id = c.req.param("id");
    const authz = await requireAuthor(c, id);
    if ("error" in authz) return jsonError(c, authz.error, authz.status);

    const body = await readJson(c);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (
        !name ||
        name.includes("/") ||
        name === "." ||
        name === ".." ||
        name === ""
    ) {
        return jsonError(c, "文件名不合法", 400);
    }
    const content = typeof body?.content === "string" ? body.content : "";
    const contentType =
        typeof body?.contentType === "string" ? body.contentType : undefined;
    const key = `works/${id}/${name}`;

    const existing = await db
        .select()
        .from(workFile)
        .where(and(eq(workFile.workId, id), eq(workFile.key, key)))
        .limit(1);
    if (existing.length > 0) return jsonError(c, "同名文件已存在", 409);

    const bytes = new TextEncoder().encode(content);
    const storage = createStorage();
    await storage.put(key, bytes, { contentType });

    await db.insert(workFile).values({
        id: crypto.randomUUID(),
        workId: id,
        key,
        name,
        size: bytes.byteLength,
        contentType: contentType ?? null,
    });

    return c.json(
        { ok: true, key, name, size: bytes.byteLength, version: 1 },
        201,
    );
});

works.put("/:id/files/content", async (c) => {
    const id = c.req.param("id");
    const authz = await requireAuthor(c, id);
    if ("error" in authz) return jsonError(c, authz.error, authz.status);

    const body = await readJson(c);
    const key = typeof body?.key === "string" ? body.key : "";
    if (!key) return jsonError(c, "缺少 key", 400);
    const content = typeof body?.content === "string" ? body.content : "";

    const [file] = await db
        .select()
        .from(workFile)
        .where(and(eq(workFile.workId, id), eq(workFile.key, key)))
        .limit(1);
    if (!file) return jsonError(c, "文件不存在", 404);

    const currentVersion = file.version ?? 1;
    if (body?.expectedVersion !== undefined) {
        const expected = Number(body.expectedVersion);
        if (!Number.isInteger(expected) || expected !== currentVersion) {
            return c.json(
                {
                    error: "文件已被他人修改，请刷新后重试",
                    currentVersion,
                },
                409,
            );
        }
    }

    const bytes = new TextEncoder().encode(content);
    const storage = createStorage();
    await storage.put(file.key, bytes, {
        contentType: file.contentType ?? undefined,
    });

    const nextVersion = currentVersion + 1;
    await db
        .update(workFile)
        .set({ size: bytes.byteLength, version: nextVersion })
        .where(eq(workFile.id, file.id));

    return c.json({
        ok: true,
        key,
        size: bytes.byteLength,
        version: nextVersion,
    });
});

works.get("/:id/versions", async (c) => {
    const id = c.req.param("id");

    const rows = await db
        .select({
            version: workVersion.version,
            message: workVersion.message,
            createdAt: workVersion.createdAt,
        })
        .from(workVersion)
        .where(eq(workVersion.workId, id))
        .orderBy(desc(workVersion.version));

    return c.json(rows);
});

works.get("/:id/versions/:version", async (c) => {
    const id = c.req.param("id");
    const version = Number(c.req.param("version"));
    if (!Number.isInteger(version) || version < 1) {
        return jsonError(c, "版本号不合法", 400);
    }

    const [row] = await db
        .select()
        .from(workVersion)
        .where(
            and(eq(workVersion.workId, id), eq(workVersion.version, version)),
        );
    if (!row) return jsonError(c, "版本不存在", 404);

    const storage = createStorage();
    const raw = await storage.get(row.snapshotKey);
    if (!raw) return jsonError(c, "快照数据丢失", 500);

    return c.json(JSON.parse(new TextDecoder().decode(raw)));
});

works.post("/:id/versions", async (c) => {
    const id = c.req.param("id");
    const authz = await requireAuthor(c, id);
    if ("error" in authz) return jsonError(c, authz.error, authz.status);

    const body = await readJson(c);
    const message =
        typeof body?.message === "string" ? body.message.trim() || null : null;

    const files = await db
        .select()
        .from(workFile)
        .where(eq(workFile.workId, id));

    const storage = createStorage();
    const entries: SnapshotFile[] = [];
    for (const file of files) {
        const data = await storage.get(file.key);
        entries.push({
            key: file.key,
            name: file.name,
            contentType: file.contentType,
            content: data ? new TextDecoder().decode(data) : "",
        });
    }

    const [agg] = await db
        .select({
            max: sql<number>`coalesce(max(${workVersion.version}), 0)`,
        })
        .from(workVersion)
        .where(eq(workVersion.workId, id));
    const version = (agg.max ?? 0) + 1;

    const createdAt = new Date();
    const snapshotKey = `works/${id}/snapshots/v${version}.json`;
    const payload: Snapshot = {
        version,
        message,
        createdAt: createdAt.getTime(),
        files: entries,
    };
    await storage.put(
        snapshotKey,
        new TextEncoder().encode(JSON.stringify(payload)),
        {
            contentType: "application/json",
        },
    );

    await db.insert(workVersion).values({
        id: crypto.randomUUID(),
        workId: id,
        version,
        snapshotKey,
        message,
        createdAt,
    });

    return c.json(
        {
            id,
            version,
            message,
            createdAt,
            fileCount: entries.length,
        },
        201,
    );
});

works.post("/:id/versions/:version/restore", async (c) => {
    const id = c.req.param("id");
    const authz = await requireAuthor(c, id);
    if ("error" in authz) return jsonError(c, authz.error, authz.status);

    const version = Number(c.req.param("version"));
    if (!Number.isInteger(version) || version < 1) {
        return jsonError(c, "版本号不合法", 400);
    }

    const [row] = await db
        .select()
        .from(workVersion)
        .where(
            and(eq(workVersion.workId, id), eq(workVersion.version, version)),
        );
    if (!row) return jsonError(c, "版本不存在", 404);

    const storage = createStorage();
    const raw = await storage.get(row.snapshotKey);
    if (!raw) return jsonError(c, "快照数据丢失", 500);

    const snapshot = JSON.parse(new TextDecoder().decode(raw)) as Snapshot;
    const files = Array.isArray(snapshot.files) ? snapshot.files : [];

    for (const file of files) {
        const content = typeof file.content === "string" ? file.content : "";
        const bytes = new TextEncoder().encode(content);

        const [existing] = await db
            .select()
            .from(workFile)
            .where(and(eq(workFile.workId, id), eq(workFile.key, file.key)))
            .limit(1);

        await storage.put(file.key, bytes, {
            contentType: file.contentType ?? undefined,
        });

        if (existing) {
            await db
                .update(workFile)
                .set({
                    size: bytes.byteLength,
                    version: sql`${workFile.version} + 1`,
                })
                .where(eq(workFile.id, existing.id));
        } else {
            await db.insert(workFile).values({
                id: crypto.randomUUID(),
                workId: id,
                key: file.key,
                name: file.name || file.key.split("/").pop() || file.key,
                size: bytes.byteLength,
                contentType: file.contentType ?? null,
            });
        }
    }

    return c.json({ ok: true, restoredVersion: version, files: files.length });
});

works.post("/", async (c) => {
    const session = await auth.api.getSession({
        headers: c.req.raw.headers,
    });
    if (!session?.user) return jsonError(c, "未登录", 401);

    const form = await c.req.parseBody();
    const title = String(form.title ?? "").trim();
    if (!title) return jsonError(c, "标题不能为空", 400);

    const description = form.description ? String(form.description) : null;
    const tags = form.tags ? String(form.tags) : "[]";
    const uploaded = Array.isArray(form.files)
        ? form.files
        : form.files
          ? [form.files]
          : [];
    const files = uploaded.filter((f): f is File => f instanceof File);

    const storage = createStorage();
    const workId = crypto.randomUUID();

    await db.insert(work).values({
        id: workId,
        userId: session.user.id,
        title,
        description,
        tags,
        status: "published",
    });

    for (const file of files) {
        const key = `works/${workId}/${file.name}`;
        await storage.put(key, file, { contentType: file.type || undefined });
        await db.insert(workFile).values({
            id: crypto.randomUUID(),
            workId,
            key,
            name: file.name,
            size: file.size,
            contentType: file.type || null,
        });
    }

    return c.json({ id: workId, title, files: files.length }, 201);
});

function parseTags(raw: string | null): string[] {
    if (!raw) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed)
            ? parsed.filter((t): t is string => typeof t === "string")
            : [];
    } catch {
        return [];
    }
}
