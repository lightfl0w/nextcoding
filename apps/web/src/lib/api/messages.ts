import { getJson, mutateJson } from "./http";

export interface ConversationUser {
    id: string;
    name: string | null;
    image: string | null;
}

export interface Conversation {
    id: string;
    otherUser: ConversationUser;
    lastMessage: string | null;
    lastMessageAt: string | null;
    unreadCount: number;
}

export interface Message {
    id: string;
    content: string;
    senderId: string;
    read: boolean;
    recalled: boolean;
    createdAt: string;
    sender: ConversationUser;
}

export function conversationsPath() {
    return "/api/messages/conversations";
}

export function conversationPath(id: string) {
    return `/api/messages/conversations/${id}`;
}

export function conversationMessagesPath(
    id: string,
    limit?: number,
    offset?: number,
) {
    const params = new URLSearchParams();
    if (limit) {
        params.set("limit", String(limit));
    }
    if (offset) {
        params.set("offset", String(offset));
    }
    const qs = params.toString();
    return `/api/messages/conversations/${id}${qs ? `?${qs}` : ""}`;
}

export function unreadMessageCountPath() {
    return "/api/messages/unread-count";
}

export async function fetchConversations(
    path: string,
): Promise<Conversation[]> {
    return getJson<Conversation[]>(path);
}

export async function fetchMessages(path: string): Promise<Message[]> {
    return getJson<Message[]>(path);
}

export async function createConversation(
    userId: string,
): Promise<{ id: string }> {
    return mutateJson<{ id: string }>(conversationsPath(), "POST", { userId });
}

export async function sendMessage(
    conversationId: string,
    content: string,
): Promise<Message> {
    return mutateJson<Message>(conversationPath(conversationId), "POST", {
        content,
    });
}

export async function markConversationRead(
    conversationId: string,
): Promise<void> {
    await mutateJson(
        `/api/messages/conversations/${conversationId}/read`,
        "POST",
    );
}

export async function recallMessage(
    conversationId: string,
    messageId: string,
): Promise<{ ok: boolean }> {
    return mutateJson<{ ok: boolean }>(
        `/api/messages/conversations/${conversationId}/recall`,
        "POST",
        { messageId },
    );
}

export async function fetchUnreadMessageCount(
    path: string,
): Promise<{ count: number }> {
    return getJson<{ count: number }>(path);
}
