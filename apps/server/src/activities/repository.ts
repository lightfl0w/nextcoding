import { activity, db, follow, user, userSettings, work } from "@nextcoding/db";
import { desc, eq, sql } from "drizzle-orm";

export const ACTIVITY_PAGE_SIZE = 50;

export type ActivityType =
    | "spark"
    | "remix"
    | "comment"
    | "publish"
    | "follow"
    | "template";

export function userExists(userId: string) {
    return db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1)
        .get()
        .then((row) => Boolean(row));
}

export function findActivityVisibility(userId: string) {
    return db
        .select({ showActivity: userSettings.showActivity })
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1)
        .get();
}

export function insertActivity(values: {
    userId: string;
    type: ActivityType;
    actorId?: string | null;
    workId?: string | null;
    targetUserId?: string | null;
    commentId?: string | null;
}) {
    return db.insert(activity).values({ id: crypto.randomUUID(), ...values });
}

const activityDetail = {
    id: activity.id,
    type: activity.type,
    createdAt: activity.createdAt,
    actorId: activity.actorId,
    actorName: user.name,
    actorImage: user.image,
    workId: activity.workId,
    workTitle: work.title,
    targetUserId: activity.targetUserId,
    targetUserName: sql<string | null>`(
        SELECT tu.name FROM user tu WHERE tu.id = ${activity.targetUserId}
    )`,
    targetUserImage: sql<string | null>`(
        SELECT tu.image FROM user tu WHERE tu.id = ${activity.targetUserId}
    )`,
    commentId: activity.commentId,
    commentContent: sql<string | null>`(
        SELECT wc.content FROM work_comment wc WHERE wc.id = ${activity.commentId}
    )`,
};

export function listUserActivities(
    userId: string,
    limit = ACTIVITY_PAGE_SIZE,
    offset = 0,
) {
    return db
        .select(activityDetail)
        .from(activity)
        .leftJoin(user, eq(user.id, activity.actorId))
        .leftJoin(work, eq(work.id, activity.workId))
        .where(eq(activity.userId, userId))
        .orderBy(desc(activity.createdAt))
        .limit(limit)
        .offset(offset);
}

export function listFeedActivities(
    userId: string,
    limit = ACTIVITY_PAGE_SIZE,
    offset = 0,
) {
    return db
        .select({ ...activityDetail, activityUserId: activity.userId })
        .from(activity)
        .innerJoin(follow, eq(follow.followingId, activity.userId))
        .leftJoin(user, eq(user.id, activity.actorId))
        .leftJoin(work, eq(work.id, activity.workId))
        .where(eq(follow.followerId, userId))
        .orderBy(desc(activity.createdAt))
        .limit(limit)
        .offset(offset);
}
