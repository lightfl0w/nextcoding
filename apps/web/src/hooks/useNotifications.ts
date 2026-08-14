import { useEffect } from "react";
import useSWR from "swr";
import { useAuth } from "~/hooks/useAuth";
import type { AppNotification } from "~/lib/api";
import { fetchNotifications, notificationsKey } from "~/lib/api";
import { subscribeNotificationStream } from "~/lib/notificationStream";

const MAX_NOTIFICATIONS = 100;
const EMPTY_NOTIFICATIONS: AppNotification[] = [];

/**
 * 通知列表。
 * @remarks 通过 SSE 实时推送，断线重连后自动重新拉取。
 */
export function useNotifications() {
    const { user } = useAuth();
    const userId = user?.id ?? null;

    const { data, isLoading, mutate } = useSWR<AppNotification[]>(
        userId ? notificationsKey(userId) : null,
        fetchNotifications,
    );

    useEffect(() => {
        if (!userId) {
            return;
        }
        return subscribeNotificationStream(userId, (event) => {
            if (event.type === "notification") {
                mutate(
                    (current = []) =>
                        mergeNotification(current, event.notification),
                    { revalidate: false },
                );
            } else if (event.type === "reconnected") {
                mutate();
            }
        });
    }, [userId, mutate]);

    return {
        notifications: data ?? EMPTY_NOTIFICATIONS,
        isLoading: Boolean(userId) && isLoading,
        mutate,
    };
}

function mergeNotification(
    list: AppNotification[],
    next: AppNotification,
): AppNotification[] {
    return [next, ...list.filter((item) => item.id !== next.id)].slice(
        0,
        MAX_NOTIFICATIONS,
    );
}
