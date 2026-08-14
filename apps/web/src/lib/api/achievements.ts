import { getJson } from "./http";

export interface Achievement {
    id: string;
    key: string;
    name: string;
    description: string;
    icon: string;
    category: string | null;
    threshold: number | null;
}

export interface UserAchievement extends Achievement {
    unlockedAt: string;
}

export interface AchievementProgress extends Achievement {
    unlocked: boolean;
    progress: number;
}

export function achievementsPath() {
    return "/api/achievements";
}

export function userAchievementsPath(userId: string) {
    return `/api/users/${userId}/achievements`;
}

export function achievementProgressPath() {
    return "/api/achievements/progress";
}

export async function fetchAchievements(path: string): Promise<Achievement[]> {
    return getJson<Achievement[]>(path);
}

export async function fetchUserAchievements(
    path: string,
): Promise<UserAchievement[]> {
    return getJson<UserAchievement[]>(path);
}

export async function fetchAchievementProgress(
    path: string,
): Promise<AchievementProgress[]> {
    return getJson<AchievementProgress[]>(path);
}
