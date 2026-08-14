export type MessageStreamEvent = {
    type: "message" | "unread";
    payload: unknown;
};

type Listener = (event: MessageStreamEvent) => void;

const listenersByUser = new Map<string, Set<Listener>>();

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

export function publishUnreadCount(userId: string, count: number): void {
    publishToUser(userId, { type: "unread", payload: { count } });
}
