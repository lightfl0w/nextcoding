import { db, chapter, novel, user } from "@nextcoding/db";
import { and, asc, desc, eq, or, sql } from "drizzle-orm";

export interface NovelListItem {
    id: string;
    title: string;
    description: string | null;
    coverUrl: string | null;
    published: boolean;
    authorId: string;
    authorName: string | null;
    chapterCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface ChapterSummary {
    id: string;
    title: string;
    position: number;
    updatedAt: Date;
    createdAt: Date;
}

const CHAPTER_COUNT = sql<number>`
    (SELECT COUNT(*) FROM chapter WHERE chapter.novel_id = ${novel.id})
`;

/**
 * 列出小说（含作者名与章节数），按更新时间倒序。
 * 可见性：已发布的小说对所有人可见；未发布的草稿仅作者本人可见。
 * `currentUserId` 为当前登录用户（可选，未登录传 undefined）。
 */
export async function listNovels(
    currentUserId?: string,
): Promise<NovelListItem[]> {
    const visibility = currentUserId
        ? or(eq(novel.published, true), eq(novel.userId, currentUserId))
        : eq(novel.published, true);
    const rows = await db
        .select({
            id: novel.id,
            title: novel.title,
            description: novel.description,
            coverUrl: novel.coverUrl,
            published: novel.published,
            authorId: novel.userId,
            authorName: user.name,
            chapterCount: CHAPTER_COUNT,
            createdAt: novel.createdAt,
            updatedAt: novel.updatedAt,
        })
        .from(novel)
        .leftJoin(user, eq(novel.userId, user.id))
        .where(visibility)
        .orderBy(desc(novel.updatedAt));
    return rows.map((row) => ({
        ...row,
        chapterCount: Number(row.chapterCount ?? 0),
    }));
}

/**
 * 查询单部小说。未发布且非作者访问时返回 undefined（对外不可见）。
 */
export async function findNovel(id: string, currentUserId?: string) {
    const visibility = currentUserId
        ? or(eq(novel.published, true), eq(novel.userId, currentUserId))
        : eq(novel.published, true);
    const [row] = await db
        .select({
            id: novel.id,
            title: novel.title,
            description: novel.description,
            coverUrl: novel.coverUrl,
            published: novel.published,
            authorId: novel.userId,
            authorName: user.name,
            chapterCount: CHAPTER_COUNT,
            createdAt: novel.createdAt,
            updatedAt: novel.updatedAt,
        })
        .from(novel)
        .leftJoin(user, eq(novel.userId, user.id))
        .where(and(eq(novel.id, id), visibility))
        .limit(1);
    if (!row) {
        return undefined;
    }
    return { ...row, chapterCount: Number(row.chapterCount ?? 0) };
}

export async function createNovel(values: {
    id: string;
    userId: string;
    title: string;
    description?: string | null;
}): Promise<typeof novel.$inferSelect> {
    const [inserted] = await db
        .insert(novel)
        .values({
            id: values.id,
            userId: values.userId,
            title: values.title,
            description: values.description ?? null,
            updatedAt: new Date(),
        })
        .returning();
    return inserted;
}

export async function updateNovel(
    id: string,
    values: {
        title?: string;
        description?: string | null;
        coverUrl?: string | null;
    },
): Promise<void> {
    await db
        .update(novel)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(novel.id, id));
}

/**
 * 发布小说：同时更新名称/简介/封面并置为已发布。
 */
export async function publishNovel(
    id: string,
    values: {
        title: string;
        description?: string | null;
        coverUrl?: string | null;
    },
): Promise<void> {
    await db
        .update(novel)
        .set({
            title: values.title,
            description: values.description ?? null,
            coverUrl: values.coverUrl ?? null,
            published: true,
            updatedAt: new Date(),
        })
        .where(eq(novel.id, id));
}

/**
 * 取消发布：退回草稿状态（对外不可见）。
 */
export async function unpublishNovel(id: string): Promise<void> {
    await db
        .update(novel)
        .set({ published: false, updatedAt: new Date() })
        .where(eq(novel.id, id));
}

export async function deleteNovel(id: string): Promise<void> {
    await db.delete(novel).where(eq(novel.id, id));
}

/**
 * 列出某小说的全部章节，按 `position` 升序。
 */
export async function listChapters(novelId: string): Promise<ChapterSummary[]> {
    return db
        .select({
            id: chapter.id,
            title: chapter.title,
            position: chapter.position,
            createdAt: chapter.createdAt,
            updatedAt: chapter.updatedAt,
        })
        .from(chapter)
        .where(eq(chapter.novelId, novelId))
        .orderBy(asc(chapter.position));
}

export async function findChapter(novelId: string, chapterId: string) {
    const [row] = await db
        .select()
        .from(chapter)
        .where(and(eq(chapter.id, chapterId), eq(chapter.novelId, novelId)))
        .limit(1);
    return row;
}

/**
 * 新建章节，自动排到末尾（`position` = 当前最大 + 1）。
 */
export async function createChapter(values: {
    novelId: string;
    title: string;
}): Promise<typeof chapter.$inferSelect> {
    const [max] = await db
        .select({ max: sql<number>`coalesce(max(${chapter.position}), 0)` })
        .from(chapter)
        .where(eq(chapter.novelId, values.novelId));
    const position = (Number(max?.max ?? 0)) + 1;
    const id = crypto.randomUUID();
    const [inserted] = await db
        .insert(chapter)
        .values({
            id,
            novelId: values.novelId,
            title: values.title,
            position,
            content: "",
            updatedAt: new Date(),
        })
        .returning();
    return inserted;
}

export async function updateChapter(
    chapterId: string,
    values: { title?: string; content?: string },
): Promise<typeof chapter.$inferSelect | undefined> {
    const [updated] = await db
        .update(chapter)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(chapter.id, chapterId))
        .returning();
    return updated;
}

export async function deleteChapter(
    novelId: string,
    chapterId: string,
): Promise<void> {
    await db
        .delete(chapter)
        .where(and(eq(chapter.id, chapterId), eq(chapter.novelId, novelId)));
    await renumberChapters(novelId);
}

/**
 * 删除章节后，将剩余章节的 `position` 重新压缩为 1..n，保持顺序连续。
 */
async function renumberChapters(novelId: string): Promise<void> {
    const remaining = await db
        .select({ id: chapter.id })
        .from(chapter)
        .where(eq(chapter.novelId, novelId))
        .orderBy(asc(chapter.position));
    for (let i = 0; i < remaining.length; i++) {
        await db
            .update(chapter)
            .set({ position: i + 1 })
            .where(eq(chapter.id, remaining[i].id));
    }
}
