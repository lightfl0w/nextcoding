import { useEffect } from "react";
import useSWR from "swr";
import {
    type Conversation,
    conversationsPath,
    fetchConversations,
} from "~/lib/api/messages";
import { subscribeMessageStream } from "~/lib/messageStream";
import { useAuth } from "./useAuth";

const EMPTY_CONVERSATIONS: Conversation[] = [];

export function useConversations() {
    const { isLoggedIn, user } = useAuth();
    const userId = user?.id ?? null;
    const { data, isLoading, error, mutate } = useSWR<Conversation[]>(
        isLoggedIn ? conversationsPath() : null,
        fetchConversations,
    );

    useEffect(() => {
        if (!userId) {
            return;
        }
        return subscribeMessageStream(userId, (event) => {
            if (event.type === "message" || event.type === "recall") {
                mutate();
            }
        });
    }, [userId, mutate]);

    return {
        conversations: data ?? EMPTY_CONVERSATIONS,
        isLoading,
        error,
        mutate,
    };
}
