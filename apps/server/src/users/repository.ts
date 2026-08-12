import { db, follow, spark, user, work } from "@nextcoding/db";
import { and, count, eq } from "drizzle-orm";

export function findUserById(id: string) {
    return db.select({ id: user.id }).from(user).where(eq(user.id, id)).get();
}

/**
 * 查询用户的公开资料字段（不包含邮箱等隐私字段）。
 * @param id - 用户 ID。
 */
export function findUserProfile(id: string) {
    return db
        .select({
            id: user.id,
            name: user.name,
            image: user.image,
            bio: user.bio,
            createdAt: user.createdAt,
        })
        .from(user)
        .where(eq(user.id, id))
        .get();
}

/**
 * 用户的粉丝数。
 * @param userId - 被关注的用户 ID。
 */
export function countFollowers(userId: string) {
    return db
        .select({ total: count() })
        .from(follow)
        .where(eq(follow.followingId, userId))
        .get()
        .then((row) => row?.total ?? 0);
}

/**
 * 用户关注的用户数。
 * @param userId - 关注者 ID。
 */
export function countFollowing(userId: string) {
    return db
        .select({ total: count() })
        .from(follow)
        .where(eq(follow.followerId, userId))
        .get()
        .then((row) => row?.total ?? 0);
}

export function findFollow(followerId: string, followingId: string) {
    return db
        .select({ id: follow.id })
        .from(follow)
        .where(
            and(
                eq(follow.followerId, followerId),
                eq(follow.followingId, followingId),
            ),
        )
        .limit(1)
        .get();
}

export function insertFollow(values: {
    followerId: string;
    followingId: string;
}) {
    return db.insert(follow).values({ id: crypto.randomUUID(), ...values });
}

export function deleteFollow(followerId: string, followingId: string) {
    return db
        .delete(follow)
        .where(
            and(
                eq(follow.followerId, followerId),
                eq(follow.followingId, followingId),
            ),
        );
}

/**
 * 用户送出的火花数。
 * @param userId - 用户 ID。
 */
export function countGivenSparks(userId: string) {
    return db
        .select({ total: count() })
        .from(spark)
        .where(eq(spark.userId, userId))
        .get()
        .then((row) => row?.total ?? 0);
}

/**
 * 用户作品收到的火花数。
 * @param userId - 用户 ID。
 */
export function countReceivedSparks(userId: string) {
    return db
        .select({ total: count(spark.id) })
        .from(spark)
        .innerJoin(work, eq(work.id, spark.workId))
        .where(eq(work.userId, userId))
        .get()
        .then((row) => row?.total ?? 0);
}
