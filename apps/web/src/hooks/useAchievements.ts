import useSWR from "swr";
import {
    type Achievement,
    achievementsPath,
    fetchAchievements,
} from "~/lib/api/achievements";

const EMPTY_ACHIEVEMENTS: Achievement[] = [];

export function useAchievements() {
    const { data, isLoading, error } = useSWR<Achievement[]>(
        achievementsPath(),
        fetchAchievements,
    );
    return { achievements: data ?? EMPTY_ACHIEVEMENTS, isLoading, error };
}
