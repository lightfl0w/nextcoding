import { subscribeSocketEvent } from "./socket";

export type MessageStreamEvent =
    | { type: "message"; conversationId: string; message: unknown }
    | { type: "recall"; conversationId: string; messageId: string }
    | { type: "unread"; count: number }
    | { type: "reconnected" };

type Handler = (event: MessageStreamEvent) => void;

interface UserStream {
    handlers: Set<Handler>;
    unsubs: Array<() => void>;
}

const streamsByUser = new Map<string, UserStream>();

/**
 * 订阅指定用户的私信 Socket.IO 流，返回取消订阅函数。
 * 同一用户共享一组监听器，最后一个订阅取消后移除所有监听（底层连接由 socket.ts 引用计数管理）。
 */
export function subscribeMessageStream(
    userId: string,
    handler: Handler,
): () => void {
    let stream = streamsByUser.get(userId);
    if (!stream) {
        stream = { handlers: new Set(), unsubs: [] };
        streamsByUser.set(userId, stream);
        attachListeners(stream);
    }
    stream.handlers.add(handler);
    return () => {
        stream.handlers.delete(handler);
        if (stream.handlers.size === 0) {
            detachStream(userId, stream);
        }
    };
}

function attachListeners(stream: UserStream): void {
    const onConnect = () => {
        dispatch(stream.handlers, { type: "reconnected" });
    };

    const unsubNew = subscribeSocketEvent(
        "message:new",
        (payload: unknown) => {
            const data = payload as {
                conversationId: string;
                message: unknown;
            };
            dispatch(stream.handlers, {
                type: "message",
                conversationId: data.conversationId,
                message: data.message,
            });
        },
        stream.unsubs.length === 0 ? onConnect : undefined,
    );

    const unsubRecall = subscribeSocketEvent(
        "message:recall",
        (payload: unknown) => {
            const data = payload as {
                conversationId: string;
                messageId: string;
            };
            dispatch(stream.handlers, {
                type: "recall",
                conversationId: data.conversationId,
                messageId: data.messageId,
            });
        },
    );

    const unsubUnread = subscribeSocketEvent(
        "message:unread",
        (payload: unknown) => {
            const data = payload as { count: number };
            dispatch(stream.handlers, { type: "unread", count: data.count });
        },
    );

    stream.unsubs.push(unsubNew, unsubRecall, unsubUnread);
}

function detachStream(userId: string, stream: UserStream): void {
    for (const unsub of stream.unsubs) {
        unsub();
    }
    stream.unsubs = [];
    streamsByUser.delete(userId);
}

function dispatch(handlers: Set<Handler>, event: MessageStreamEvent): void {
    for (const handler of handlers) {
        handler(event);
    }
}
