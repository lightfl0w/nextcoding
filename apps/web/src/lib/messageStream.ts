import { messagesStreamPath } from "~/lib/api/messages";

export type MessageStreamEvent =
    | { type: "message"; conversationId: string; message: unknown }
    | { type: "recall"; conversationId: string; messageId: string }
    | { type: "unread"; count: number }
    | { type: "reconnected" };

type Handler = (event: MessageStreamEvent) => void;

interface UserStream {
    handlers: Set<Handler>;
    source: EventSource | null;
}

const streamsByUser = new Map<string, UserStream>();

/**
 * 订阅指定用户的私信 SSE 流，返回取消订阅函数。
 * 同一用户共享一条连接，最后一个订阅取消后断开连接。
 */
export function subscribeMessageStream(
    userId: string,
    handler: Handler,
): () => void {
    let stream = streamsByUser.get(userId);
    if (!stream) {
        stream = { handlers: new Set(), source: null };
        streamsByUser.set(userId, stream);
    }
    stream.handlers.add(handler);
    openStream(stream);
    return () => {
        stream.handlers.delete(handler);
        if (stream.handlers.size === 0) {
            closeStream(userId, stream);
        }
    };
}

function openStream(stream: UserStream): void {
    if (stream.source) {
        return;
    }
    const es = new EventSource(messagesStreamPath());
    stream.source = es;
    es.addEventListener("unread", (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
            count: number;
        };
        dispatch(stream.handlers, { type: "unread", count: payload.count });
    });
    es.addEventListener("message", (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
            conversationId: string;
            message: unknown;
        };
        dispatch(stream.handlers, {
            type: "message",
            conversationId: payload.conversationId,
            message: payload.message,
        });
    });
    es.addEventListener("recall", (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
            conversationId: string;
            messageId: string;
        };
        dispatch(stream.handlers, {
            type: "recall",
            conversationId: payload.conversationId,
            messageId: payload.messageId,
        });
    });
    es.addEventListener("open", () => {
        dispatch(stream.handlers, { type: "reconnected" });
    });
}

function closeStream(userId: string, stream: UserStream): void {
    stream.source?.close();
    stream.source = null;
    streamsByUser.delete(userId);
}

function dispatch(handlers: Set<Handler>, event: MessageStreamEvent): void {
    for (const handler of handlers) {
        handler(event);
    }
}
