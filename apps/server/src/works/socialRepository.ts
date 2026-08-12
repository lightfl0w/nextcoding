import {
    db,
    notification,
    remix,
    spark,
    user,
    work,
    workComment,
} from "@nextcoding/db";
import { and, count, desc, eq, sql } from "drizzle-orm";

export const NOTIFICATION_PAGE_SIZE = 100;

export type NotificationType = "spark" | "remix" | "comment";

export function findSpark(workId: string, userId: string) {
    return db
        .select({ id: spark.id })
        .from(spark)
        .where(and(eq(spark.workId, workId), eq(spark.userId, userId)))
        .limit(1)
        .get();
}

export function insertSpark(values: { workId: string; userId: string }) {
    return db.insert(spark).values({ id: crypto.randomUUID(), ...values });
}

export function bumpWorkSparks(workId: string) {
    return db
        .update(work)
        .set({ sparks: sql`${work.sparks} + 1` })
        .where(eq(work.id, workId));
}

export function insertRemix(values: {
    originalId: string;
    forkId: string;
    userId: string;
}) {
    return db.insert(remix).values({ id: crypto.randomUUID(), ...values });
}

export function findSourceByFork(forkId: string) {
    return db
        .select({ id: work.id, title: work.title })
        .from(remix)
        .innerJoin(work, eq(work.id, remix.originalId))
        .where(eq(remix.forkId, forkId))
        .get();
}

export function listDirectRemixes(workId: string, limit = 50) {
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
        .from(remix)
        .innerJoin(work, eq(work.id, remix.forkId))
        .leftJoin(user, eq(user.id, work.userId))
        .where(
            and(
                eq(remix.originalId, workId),

                eq(work.status, "published"),
            ),
        )
        .orderBy(desc(remix.createdAt))
        .limit(limit);
}

export function insertNotification(values: {
    userId: string;
    type: NotificationType;
    actorId: string;
    workId: string | null;
    commentId?: string | null;
}) {
    return db
        .insert(notification)
        .values({ id: crypto.randomUUID(), ...values });
}

export function listNotifications(userId: string, limit: number) {
    return db
        .select({
            id: notification.id,
            type: notification.type,
            read: notification.read,
            createdAt: notification.createdAt,
            actorId: notification.actorId,
            actorName: user.name,
            workId: notification.workId,
            workTitle: work.title,
            commentId: notification.commentId,
            commentContent: workComment.content,
        })
        .from(notification)
        .leftJoin(user, eq(user.id, notification.actorId))
        .leftJoin(work, eq(work.id, notification.workId))
        .leftJoin(workComment, eq(workComment.id, notification.commentId))
        .where(eq(notification.userId, userId))
        .orderBy(desc(notification.createdAt))
        .limit(limit);
}

export function countUnreadNotifications(userId: string) {
    return db
        .select({ total: count() })
        .from(notification)
        .where(
            and(eq(notification.userId, userId), eq(notification.read, false)),
        )
        .get()
        .then((row) => row?.total ?? 0);
}

export function markAllNotificationsRead(userId: string) {
    return db
        .update(notification)
        .set({ read: true })
        .where(eq(notification.userId, userId));
}
