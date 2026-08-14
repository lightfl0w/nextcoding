import useSWR from "swr";
import {
    conversationMessagesPath,
    fetchMessages,
    type Message,
} from "~/lib/api/messages";
import { useAuth } from "./useAuth";

const EMPTY_MESSAGES: Message[] = [];

export function useMessages(conversationId: string | undefined) {
    const { isLoggedIn } = useAuth();
    const path =
        isLoggedIn && conversationId
            ? conversationMessagesPath(conversationId, 50)
            : null;
    const { data, isLoading, error, mutate } = useSWR<Message[]>(
        path,
        fetchMessages,
    );
    return {
        messages: data ?? EMPTY_MESSAGES,
        isLoading,
        error,
        mutate,
    };
}
