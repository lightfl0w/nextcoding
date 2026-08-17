import { emitToUser } from "../realtime/io.js";

export type MessageStreamEvent = {
    type: "message" | "recall" | "unread";
    payload: unknown;
};

type Listener = (event: MessageStreamEvent) => void;

const listenersByUser = new Map<string, Set<Listener>>();

/**
 * 事件类型
 * 与私信流共用同一连接，事件名前缀区分消息与通知，避免 unread 冲突。
 */
const SOCKET_EVENT_BY_TYPE: Record<MessageStreamEvent["type"], string> = {
    message: "message:new",
    recall: "message:recall",
    unread: "message:unread",
};

export function subscribeUser(userId: string, listener: Listener): () => void {
    let set = listenersByUser.get(userId);
    if (!set) {
        set = new Set();
        listenersByUser.set(userId, set);
    }
    set.add(listener);
    return () => {
        set.delete(listener);
        if (set.size === 0) {
            listenersByUser.delete(userId);
        }
    };
}

export function publishToUser(userId: string, event: MessageStreamEvent): void {
    const set = listenersByUser.get(userId);
    if (set) {
        for (const listener of set) {
            listener(event);
        }
    }
    emitToUser(
        userId,
        SOCKET_EVENT_BY_TYPE[event.type] ?? event.type,
        event.payload,
    );
}

export function publishNewMessage(
    userId: string,
    conversationId: string,
    message: {
        id: string;
        senderId: string;
        content: string;
        createdAt: Date;
        senderName: string | null;
        senderImage: string | null;
    },
): void {
    publishToUser(userId, {
        type: "message",
        payload: { conversationId, message },
    });
}

export function publishMessageRecalled(
    userId: string,
    conversationId: string,
    messageId: string,
): void {
    publishToUser(userId, {
        type: "recall",
        payload: { conversationId, messageId },
    });
}

export function publishUnreadCount(userId: string, count: number): void {
    publishToUser(userId, { type: "unread", payload: { count } });
}
