import useSWR from "swr";
import { useAuth } from "~/hooks/useAuth";
import type { AppNotification } from "~/lib/api";
import { fetchNotifications, notificationsKey } from "~/lib/api";

const REFRESH_INTERVAL_MS = 30_000;
const EMPTY_NOTIFICATIONS: AppNotification[] = [];

/**
 * 通知列表。
 * @remarks 30 秒轮询刷新。
 */
export function useNotifications() {
    const { user } = useAuth();
    const userId = user?.id ?? null;

    const { data, isLoading, mutate } = useSWR<AppNotification[]>(
        userId ? notificationsKey(userId) : null,
        fetchNotifications,
        { refreshInterval: REFRESH_INTERVAL_MS },
    );

    return {
        notifications: data ?? EMPTY_NOTIFICATIONS,
        isLoading: Boolean(userId) && isLoading,
        mutate,
    };
}
