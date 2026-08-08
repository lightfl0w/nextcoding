import { serve } from "@hono/node-server";
import { auth } from "@nextcoding/auth";
import { db, user, work, workFile } from "@nextcoding/db";
import { createStorage } from "@nextcoding/storage";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

app.use(cors());

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.get("/api/works", async (c) => {
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
        .orderBy(desc(work.createdAt))
        .limit(20);

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

// 作品详情 + 文件列表
app.get("/api/works/:id", async (c) => {
    const id = c.req.param("id");

    const [row] = await db.select().from(work).where(eq(work.id, id));
    if (!row) return c.json({ error: "作品不存在" }, 404);

    const files = await db
        .select()
        .from(workFile)
        .where(eq(workFile.workId, id));

    return c.json({ ...row, tags: parseTags(row.tags), files });
});

// 发布作品（multipart/form-data：title、description、tags(JSON)、files[])
app.post("/api/works", async (c) => {
    const session = await auth.api.getSession({
        headers: c.req.raw.headers,
    });
    if (!session?.user) return c.json({ error: "未登录" }, 401);

    const form = await c.req.parseBody();
    const title = String(form.title ?? "").trim();
    if (!title) return c.json({ error: "标题不能为空" }, 400);

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

    // 1. 写作品元数据
    await db.insert(work).values({
        id: workId,
        userId: session.user.id,
        title,
        description,
        tags,
        status: "published",
    });

    // 2. 存文件到存储层 + 写文件索引
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

serve(
    {
        fetch: app.fetch,
        port: 3000,
    },
    (info) => {
        console.log(`Server is running on http://localhost:${info.port}`);
    },
);
