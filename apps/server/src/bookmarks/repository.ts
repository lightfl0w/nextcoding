import { bookmark, db, user, userSettings, work } from "@nextcoding/db";
import { and, desc, eq } from "drizzle-orm";

export function findBookmark(userId: string, workId: string) {
    return db
        .select({ id: bookmark.id })
        .from(bookmark)
        .where(and(eq(bookmark.userId, userId), eq(bookmark.workId, workId)))
        .limit(1)
        .get();
}

export function insertBookmark(userId: string, workId: string) {
    return db
        .insert(bookmark)
        .values({ id: crypto.randomUUID(), userId, workId })
        .onConflictDoNothing();
}

export function deleteBookmark(userId: string, workId: string) {
    return db
        .delete(bookmark)
        .where(and(eq(bookmark.userId, userId), eq(bookmark.workId, workId)));
}

export function findBookmarkVisibility(userId: string) {
    return db
        .select({ showBookmarks: userSettings.showBookmarks })
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1)
        .get();
}

export function listUserBookmarks(userId: string, limit = 20, offset = 0) {
    return db
        .select({
            bookmarkId: bookmark.id,
            createdAt: bookmark.createdAt,
            workId: work.id,
            title: work.title,
            description: work.description,
            coverUrl: work.coverUrl,
            tags: work.tags,
            views: work.views,
            likes: work.likes,
            sparks: work.sparks,
            workCreatedAt: work.createdAt,
            authorId: user.id,
            authorName: user.name,
            authorImage: user.image,
            authorBio: user.bio,
        })
        .from(bookmark)
        .innerJoin(work, eq(work.id, bookmark.workId))
        .leftJoin(user, eq(user.id, work.userId))
        .where(eq(bookmark.userId, userId))
        .orderBy(desc(bookmark.createdAt))
        .limit(limit)
        .offset(offset);
}
