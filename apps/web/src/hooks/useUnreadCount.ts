import useSWR from "swr";
import { useAuth } from "~/hooks/useAuth";
import { fetchUnreadCount, unreadCountKey } from "~/lib/api";

const REFRESH_INTERVAL_MS = 30_000;

/**
 * 未读通知数。
 * @remarks 30 秒轮询刷新。
 */
export function useUnreadCount() {
    const { user } = useAuth();
    const userId = user?.id ?? null;

    const { data, mutate } = useSWR(
        userId ? unreadCountKey(userId) : null,
        fetchUnreadCount,
        { refreshInterval: REFRESH_INTERVAL_MS },
    );

    return { count: data?.count ?? 0, mutate };
}
