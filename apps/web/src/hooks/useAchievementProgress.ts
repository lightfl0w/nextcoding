import useSWR from "swr";
import {
    type AchievementProgress,
    achievementProgressPath,
    fetchAchievementProgress,
} from "~/lib/api/achievements";
import { useAuth } from "./useAuth";

const EMPTY_PROGRESS: AchievementProgress[] = [];

export function useAchievementProgress() {
    const { isLoggedIn } = useAuth();
    const { data, isLoading, error } = useSWR<AchievementProgress[]>(
        isLoggedIn ? achievementProgressPath() : null,
        fetchAchievementProgress,
    );
    return { achievements: data ?? EMPTY_PROGRESS, isLoading, error };
}
