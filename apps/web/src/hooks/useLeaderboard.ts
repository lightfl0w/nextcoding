import useSWR from "swr";
import {
    fetchLeaderboard,
    type LeaderboardContributor,
    type LeaderboardPeriod,
    type LeaderboardType,
    type LeaderboardWork,
    leaderboardPath,
} from "~/lib/api/leaderboard";

export function useLeaderboard(
    period: LeaderboardPeriod = "weekly",
    type: LeaderboardType = "works",
    limit?: number,
) {
    const key =
        type === "templates" ? null : leaderboardPath(period, type, limit);
    return useSWR<LeaderboardWork[] | LeaderboardContributor[]>(
        key,
        fetchLeaderboard,
    );
}
