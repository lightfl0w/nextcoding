import { db, spark, user, work } from "@nextcoding/db";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { toWorkSummary } from "../serializers.js";

export const leaderboardRoutes = new Hono();

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_IN_MS = 30 * 24 * 60 * 60 * 1000;

leaderboardRoutes.get("/leaderboard", async (c) => {
    const periodParam = c.req.query("period");
    const typeParam = c.req.query("type");
    const limitParam = c.req.query("limit");

    const period =
        periodParam === "monthly"
            ? ("monthly" as const)
            : periodParam === "all"
              ? ("all" as const)
              : ("weekly" as const);
    const type =
        typeParam === "contributors"
            ? ("contributors" as const)
            : ("works" as const);
    const limit = limitParam
        ? Math.min(Math.max(Number(limitParam), 1), 50)
        : 20;

    if (type === "works") {
        return await listWorkLeaderboard(c, period, limit);
    }
    return await listContributorLeaderboard(c, period, limit);
});

async function listWorkLeaderboard(
    c: Context,
    period: "weekly" | "monthly" | "all",
    limit: number,
) {
    if (period === "all") {
        const rows = await db
            .select({
                workId: work.id,
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
            .from(work)
            .leftJoin(user, eq(user.id, work.userId))
            .where(eq(work.status, "published"))
            .orderBy(desc(work.sparks), desc(work.createdAt))
            .limit(limit);

        const items = rows.map((row, index) => ({
            position: index + 1,
            work: toWorkSummary({ ...row, id: row.workId }),
            sparks: row.sparks,
        }));

        return c.json(items);
    }

    const since = new Date(
        Date.now() - (period === "monthly" ? MONTH_IN_MS : WEEK_IN_MS),
    );

    const rows = await db
        .select({
            workId: work.id,
            title: work.title,
            description: work.description,
            coverUrl: work.coverUrl,
            tags: work.tags,
            views: work.views,
            likes: work.likes,
            createdAt: work.createdAt,
            authorId: user.id,
            authorName: user.name,
            authorImage: user.image,
            authorBio: user.bio,
            sparkCount: count(spark.id),
        })
        .from(work)
        .leftJoin(user, eq(user.id, work.userId))
        .leftJoin(
            spark,
            and(eq(spark.workId, work.id), gte(spark.createdAt, since)),
        )
        .where(eq(work.status, "published"))
        .groupBy(work.id)
        .orderBy(desc(count(spark.id)), desc(work.createdAt))
        .limit(limit);

    const items = rows.map((row, index) => ({
        position: index + 1,
        work: toWorkSummary({
            ...row,
            id: row.workId,
            sparks: row.sparkCount,
        }),
        sparks: row.sparkCount,
    }));

    return c.json(items);
}

async function listContributorLeaderboard(
    c: Context,
    period: "weekly" | "monthly" | "all",
    limit: number,
) {
    if (period === "all") {
        const rows = await db
            .select({
                userId: user.id,
                userName: user.name,
                userImage: user.image,
                userBio: user.bio,
                totalSparks: sql<number>`cast(sum(${work.sparks}) as integer)`,
            })
            .from(work)
            .leftJoin(user, eq(user.id, work.userId))
            .where(eq(work.status, "published"))
            .groupBy(user.id)
            .orderBy(desc(sql`sum(${work.sparks})`))
            .limit(limit);

        const items = rows.map((row, index) => ({
            position: index + 1,
            author: {
                id: row.userId,
                name: row.userName,
                image: row.userImage,
                bio: row.userBio,
            },
            totalSparks: row.totalSparks ?? 0,
        }));

        return c.json(items);
    }

    const since = new Date(
        Date.now() - (period === "monthly" ? MONTH_IN_MS : WEEK_IN_MS),
    );

    const rows = await db
        .select({
            userId: user.id,
            userName: user.name,
            userImage: user.image,
            userBio: user.bio,
            totalSparks: count(spark.id),
        })
        .from(work)
        .leftJoin(user, eq(user.id, work.userId))
        .leftJoin(
            spark,
            and(eq(spark.workId, work.id), gte(spark.createdAt, since)),
        )
        .where(eq(work.status, "published"))
        .groupBy(user.id)
        .orderBy(desc(count(spark.id)))
        .limit(limit);

    const items = rows.map((row, index) => ({
        position: index + 1,
        author: {
            id: row.userId,
            name: row.userName,
            image: row.userImage,
            bio: row.userBio,
        },
        totalSparks: row.totalSparks,
    }));

    return c.json(items);
}
