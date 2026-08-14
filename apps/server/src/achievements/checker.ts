import {
    countUserFollowers,
    countUserReceivedSparks,
    countUserRemixes,
    countUserSparks,
    countUserWorks,
    unlockAchievement,
} from "./repository.js";

interface AchievementCheck {
    key: string;
    fetchCount: (userId: string) => Promise<number>;
    threshold: number;
}

const ACHIEVEMENT_CHECKS: AchievementCheck[] = [
    { key: "first_publish", fetchCount: countUserWorks, threshold: 1 },
    { key: "publish_5", fetchCount: countUserWorks, threshold: 5 },
    { key: "publish_20", fetchCount: countUserWorks, threshold: 20 },
    { key: "spark_first", fetchCount: countUserReceivedSparks, threshold: 1 },
    { key: "spark_10", fetchCount: countUserReceivedSparks, threshold: 10 },
    { key: "spark_100", fetchCount: countUserReceivedSparks, threshold: 100 },
    { key: "remix_first", fetchCount: countUserRemixes, threshold: 1 },
    { key: "remix_10", fetchCount: countUserRemixes, threshold: 10 },
    { key: "follower_10", fetchCount: countUserFollowers, threshold: 10 },
    { key: "follower_100", fetchCount: countUserFollowers, threshold: 100 },
    { key: "give_spark_10", fetchCount: countUserSparks, threshold: 10 },
    { key: "give_spark_100", fetchCount: countUserSparks, threshold: 100 },
];

export async function checkAndUnlockAchievements(userId: string) {
    const unlocked: Array<{
        key: string;
        name: string;
        description: string;
        icon: string;
    }> = [];

    for (const check of ACHIEVEMENT_CHECKS) {
        const current = await check.fetchCount(userId);
        if (current >= check.threshold) {
            const result = await unlockAchievement(userId, check.key);
            if (result) {
                unlocked.push({
                    key: result.key,
                    name: result.name,
                    description: result.description,
                    icon: result.icon,
                });
            }
        }
    }

    return unlocked;
}
