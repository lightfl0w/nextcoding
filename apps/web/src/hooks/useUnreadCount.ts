import { useEffect } from "react";
import useSWR from "swr";
import { useAuth } from "~/hooks/useAuth";
import { fetchUnreadCount, unreadCountKey } from "~/lib/api";
import { subscribeNotificationStream } from "~/lib/notificationStream";

/**
 * 未读通知数。
 * @remarks 通过 SSE 实时推送，断线重连后自动重新拉取。
 */
export function useUnreadCount() {
    const { user } = useAuth();
    const userId = user?.id ?? null;

    const { data, mutate } = useSWR(
        userId ? unreadCountKey(userId) : null,
        fetchUnreadCount,
    );

    useEffect(() => {
        if (!userId) {
            return;
        }
        return subscribeNotificationStream(userId, (event) => {
            if (event.type === "reconnected") {
                mutate();
            } else {
                mutate({ count: event.unreadCount }, { revalidate: false });
            }
        });
    }, [userId, mutate]);

    return { count: data?.count ?? 0, mutate };
}
