import { getJson } from "./http";
import type { Author, Work } from "./types";

export interface LeaderboardWork {
    position: number;
    work: Work;
    sparks: number;
}

export interface LeaderboardContributor {
    position: number;
    author: Author;
    totalSparks: number;
}

export type LeaderboardPeriod = "weekly" | "monthly" | "all";
export type LeaderboardType = "works" | "contributors";

export function leaderboardPath(
    period: LeaderboardPeriod = "weekly",
    type: LeaderboardType = "works",
    limit?: number,
) {
    const params = new URLSearchParams({ period, type });
    if (limit) {
        params.set("limit", String(limit));
    }
    return `/api/works/leaderboard?${params.toString()}`;
}

export async function fetchLeaderboard(
    path: string,
): Promise<LeaderboardWork[] | LeaderboardContributor[]> {
    return getJson<LeaderboardWork[] | LeaderboardContributor[]>(path);
}
