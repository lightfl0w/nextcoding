import useSWR from "swr";
import {
    fetchUnreadMessageCount,
    unreadMessageCountPath,
} from "~/lib/api/messages";
import { useAuth } from "./useAuth";

export function useUnreadMessageCount() {
    const { isLoggedIn } = useAuth();
    const { data } = useSWR<{ count: number }>(
        isLoggedIn ? unreadMessageCountPath() : null,
        fetchUnreadMessageCount,
    );
    return { count: data?.count ?? 0 };
}
