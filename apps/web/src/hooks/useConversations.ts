import useSWR from "swr";
import {
    type Conversation,
    conversationsPath,
    fetchConversations,
} from "~/lib/api/messages";
import { useAuth } from "./useAuth";

const EMPTY_CONVERSATIONS: Conversation[] = [];

export function useConversations() {
    const { isLoggedIn } = useAuth();
    const { data, isLoading, error, mutate } = useSWR<Conversation[]>(
        isLoggedIn ? conversationsPath() : null,
        fetchConversations,
    );
    return {
        conversations: data ?? EMPTY_CONVERSATIONS,
        isLoading,
        error,
        mutate,
    };
}
