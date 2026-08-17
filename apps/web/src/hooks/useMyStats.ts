import useSWR from "swr";
import { useAuth } from "~/hooks/useAuth";
import type { MyStats } from "~/lib/api";
import { fetchMyStats } from "~/lib/api";

const NO_STATS: MyStats = {
    givenSparks: 0,
    receivedSparks: 0,
    sparkBalance: 0,
};

/**
 * 当前用户的火花统计。
 * @returns 剩余火花余额、送出的与收到的火花数。
 */
export function useMyStats() {
    const { user } = useAuth();
    const userId = user?.id ?? null;

    const { data } = useSWR<MyStats>(
        userId ? ["my-stats", userId] : null,
        fetchMyStats,
    );

    return data ?? NO_STATS;
}
