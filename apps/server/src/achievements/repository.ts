import {
    achievement,
    db,
    follow,
    remix,
    spark,
    userAchievement,
    work,
} from "@nextcoding/db";
import { and, count, eq } from "drizzle-orm";

export function listAchievements() {
    return db
        .select()
        .from(achievement)
        .orderBy(achievement.category, achievement.threshold);
}

export function listUserAchievements(userId: string) {
    return db
        .select({
            id: achievement.id,
            key: achievement.key,
            name: achievement.name,
            description: achievement.description,
            icon: achievement.icon,
            category: achievement.category,
            threshold: achievement.threshold,
            unlockedAt: userAchievement.unlockedAt,
        })
        .from(userAchievement)
        .innerJoin(
            achievement,
            eq(userAchievement.achievementId, achievement.id),
        )
        .where(eq(userAchievement.userId, userId))
        .orderBy(userAchievement.unlockedAt);
}

export async function findUserAchievement(
    userId: string,
    achievementKey: string,
) {
    const [row] = await db
        .select({ id: userAchievement.id })
        .from(userAchievement)
        .innerJoin(
            achievement,
            eq(userAchievement.achievementId, achievement.id),
        )
        .where(
            and(
                eq(userAchievement.userId, userId),
                eq(achievement.key, achievementKey),
            ),
        )
        .limit(1);
    return row ?? null;
}

export async function unlockAchievement(
    userId: string,
    achievementKey: string,
) {
    const [ach] = await db
        .select()
        .from(achievement)
        .where(eq(achievement.key, achievementKey))
        .limit(1);
    if (!ach) {
        return null;
    }

    const existing = await findUserAchievement(userId, achievementKey);
    if (existing) {
        return null;
    }

    await db.insert(userAchievement).values({
        id: crypto.randomUUID(),
        userId,
        achievementId: ach.id,
        unlockedAt: new Date(),
    });
    return ach;
}

export async function countUserSparks(userId: string) {
    const [row] = await db
        .select({ total: count() })
        .from(spark)
        .where(eq(spark.userId, userId));
    return row?.total ?? 0;
}

export async function countUserReceivedSparks(userId: string) {
    const [row] = await db
        .select({ total: count() })
        .from(spark)
        .innerJoin(work, eq(spark.workId, work.id))
        .where(eq(work.userId, userId));
    return row?.total ?? 0;
}

export async function countUserWorks(userId: string) {
    const [row] = await db
        .select({ total: count() })
        .from(work)
        .where(and(eq(work.userId, userId), eq(work.status, "published")));
    return row?.total ?? 0;
}

export async function countUserRemixes(userId: string) {
    const [row] = await db
        .select({ total: count() })
        .from(remix)
        .where(eq(remix.userId, userId));
    return row?.total ?? 0;
}

export async function countUserFollowers(userId: string) {
    const [row] = await db
        .select({ total: count() })
        .from(follow)
        .where(eq(follow.followingId, userId));
    return row?.total ?? 0;
}
