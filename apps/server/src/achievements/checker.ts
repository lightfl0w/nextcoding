import {
    countUserFollowers,
    countUserReceivedSparks,
    countUserRemixes,
    countUserSparks,
    countUserTemplateMaxUses,
    countUserTemplates,
    countUserTemplateTotalUses,
    countUserWorks,
    unlockAchievement,
} from "./repository.js";

interface AchievementCheck {
    key: string;
    threshold: number;
    fetchCount?: (userId: string) => Promise<number>;
    isUnlocked?: (userId: string) => Promise<boolean>;
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
    { key: "template_first", fetchCount: countUserTemplates, threshold: 1 },
    {
        key: "template_used_100",
        fetchCount: countUserTemplateMaxUses,
        threshold: 100,
    },
    {
        key: "template_master",
        threshold: 5,
        isUnlocked: async (userId) => {
            const [templates, totalUses] = await Promise.all([
                countUserTemplates(userId),
                countUserTemplateTotalUses(userId),
            ]);
            return templates >= 5 && totalUses >= 1000;
        },
    },
];

export async function checkAndUnlockAchievements(userId: string) {
    const unlocked: Array<{
        key: string;
        name: string;
        description: string;
        icon: string;
    }> = [];

    for (const check of ACHIEVEMENT_CHECKS) {
        const passed = check.isUnlocked
            ? await check.isUnlocked(userId)
            : ((await check.fetchCount?.(userId)) ?? 0) >= check.threshold;
        if (!passed) {
            continue;
        }
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

    return unlocked;
}
