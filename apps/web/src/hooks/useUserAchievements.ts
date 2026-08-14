import useSWR from "swr";
import {
    fetchUserAchievements,
    type UserAchievement,
    userAchievementsPath,
} from "~/lib/api/achievements";

const EMPTY_ACHIEVEMENTS: UserAchievement[] = [];

export function useUserAchievements(userId: string) {
    const { data, isLoading, error } = useSWR<UserAchievement[]>(
        userAchievementsPath(userId),
        fetchUserAchievements,
    );
    return { achievements: data ?? EMPTY_ACHIEVEMENTS, isLoading, error };
}
