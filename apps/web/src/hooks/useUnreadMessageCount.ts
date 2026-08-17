import { useEffect } from "react";
import useSWR from "swr";
import {
    fetchUnreadMessageCount,
    unreadMessageCountPath,
} from "~/lib/api/messages";
import { subscribeMessageStream } from "~/lib/messageStream";
import { useAuth } from "./useAuth";

/**
 * 未读私信数。
 * @remarks 通过私信 SSE 流实时推送，断线重连后自动重新拉取。
 */
export function useUnreadMessageCount() {
    const { user } = useAuth();
    const userId = user?.id ?? null;

    const { data, mutate } = useSWR<{ count: number }>(
        userId ? ["message-unread", userId] : null,
        () => fetchUnreadMessageCount(unreadMessageCountPath()),
    );

    useEffect(() => {
        if (!userId) {
            return;
        }
        return subscribeMessageStream(userId, (event) => {
            if (event.type === "reconnected") {
                mutate();
            } else if (event.type === "unread") {
                mutate({ count: event.count }, { revalidate: false });
            }
        });
    }, [userId, mutate]);

    return { count: data?.count ?? 0, mutate };
}
