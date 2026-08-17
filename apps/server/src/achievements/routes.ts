import { Hono } from "hono";
import { type AuthenticatedEnv, requireSession } from "../http/guards.js";
import {
    countUserFollowers,
    countUserReceivedSparks,
    countUserRemixes,
    countUserSparks,
    countUserWorks,
    listAchievements,
    listUserAchievements,
} from "./repository.js";

export const achievementRoutes = new Hono<AuthenticatedEnv>();

achievementRoutes.get("/", async (c) => {
    const rows = await listAchievements();
    return c.json(rows);
});

achievementRoutes.get("/progress", requireSession, async (c) => {
    const userId = c.get("userId");
    const allAchievements = await listAchievements();
    const userAchievements = await listUserAchievements(userId);
    const unlockedKeys = new Set(userAchievements.map((a) => a.key));

    const progressChecks: Record<string, () => Promise<number>> = {
        first_publish: () => countUserWorks(userId),
        publish_5: () => countUserWorks(userId),
        publish_20: () => countUserWorks(userId),
        spark_first: () => countUserReceivedSparks(userId),
        spark_10: () => countUserReceivedSparks(userId),
        spark_100: () => countUserReceivedSparks(userId),
        remix_first: () => countUserRemixes(userId),
        remix_10: () => countUserRemixes(userId),
        follow_first: () => countUserFollowers(userId),
        follower_10: () => countUserFollowers(userId),
        follower_100: () => countUserFollowers(userId),
        give_spark_10: () => countUserSparks(userId),
        give_spark_100: () => countUserSparks(userId),
    };

    const results = await Promise.all(
        allAchievements.map(async (ach) => {
            const fetcher = progressChecks[ach.key];
            const progress = fetcher ? await fetcher() : 0;
            return {
                ...ach,
                unlocked: unlockedKeys.has(ach.key),
                progress,
            };
        }),
    );

    return c.json(results);
});
