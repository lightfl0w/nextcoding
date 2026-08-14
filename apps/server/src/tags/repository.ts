import { db, tag, user, work, workTag } from "@nextcoding/db";
import { and, desc, eq, like, sql } from "drizzle-orm";

function slugify(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

export function listTags(keyword?: string, sortBy?: "name" | "workCount") {
    const conditions = keyword
        ? like(tag.name, `%${keyword.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`)
        : undefined;

    const orderBy = sortBy === "workCount" ? desc(tag.workCount) : tag.name;

    return db
        .select({
            id: tag.id,
            name: tag.name,
            slug: tag.slug,
            description: tag.description,
            color: tag.color,
            workCount: tag.workCount,
            createdAt: tag.createdAt,
        })
        .from(tag)
        .where(conditions)
        .orderBy(orderBy);
}

export function findTagBySlug(slug: string) {
    return db
        .select({
            id: tag.id,
            name: tag.name,
            slug: tag.slug,
            description: tag.description,
            color: tag.color,
            workCount: tag.workCount,
            createdAt: tag.createdAt,
        })
        .from(tag)
        .where(eq(tag.slug, slug))
        .limit(1)
        .get();
}

export function listTagWorks(
    tagId: string,
    sort: "latest" | "popular" | "weekly" = "latest",
    limit = 20,
) {
    const orderBy =
        sort === "popular"
            ? [desc(work.sparks), desc(work.views), desc(work.createdAt)]
            : sort === "weekly"
              ? [desc(work.sparks), desc(work.createdAt)]
              : [desc(work.createdAt)];

    return db
        .select({
            id: work.id,
            title: work.title,
            description: work.description,
            coverUrl: work.coverUrl,
            tags: work.tags,
            views: work.views,
            likes: work.likes,
            sparks: work.sparks,
            createdAt: work.createdAt,
            authorId: user.id,
            authorName: user.name,
            authorImage: user.image,
            authorBio: user.bio,
        })
        .from(workTag)
        .innerJoin(work, eq(work.id, workTag.workId))
        .leftJoin(user, eq(user.id, work.userId))
        .where(and(eq(workTag.tagId, tagId), eq(work.status, "published")))
        .orderBy(...orderBy)
        .limit(limit);
}

export function listPopularTags(limit: number) {
    return db
        .select({
            id: tag.id,
            name: tag.name,
            slug: tag.slug,
            description: tag.description,
            color: tag.color,
            workCount: tag.workCount,
        })
        .from(tag)
        .orderBy(desc(tag.workCount))
        .limit(limit);
}

export async function ensureTag(name: string) {
    const baseSlug = slugify(name);
    let slug = baseSlug;
    let suffix = 1;

    const existing = await db
        .select({ id: tag.id, slug: tag.slug })
        .from(tag)
        .where(eq(tag.name, name))
        .limit(1)
        .get();

    if (existing) {
        return existing;
    }

    while (true) {
        const conflict = await db
            .select({ id: tag.id })
            .from(tag)
            .where(eq(tag.slug, slug))
            .limit(1)
            .get();

        if (!conflict) {
            break;
        }
        slug = `${baseSlug}-${suffix}`;
        suffix++;
    }

    const id = crypto.randomUUID();
    await db.insert(tag).values({ id, name, slug });
    return { id, slug };
}

export function attachWorkTag(workId: string, tagId: string) {
    return db
        .insert(workTag)
        .values({ id: crypto.randomUUID(), workId, tagId })
        .onConflictDoNothing();
}

export function detachWorkTags(workId: string) {
    return db.delete(workTag).where(eq(workTag.workId, workId));
}

export function bumpTagWorkCount(tagId: string, delta: number) {
    return db
        .update(tag)
        .set({ workCount: sql`${tag.workCount} + ${delta}` })
        .where(eq(tag.id, tagId));
}
