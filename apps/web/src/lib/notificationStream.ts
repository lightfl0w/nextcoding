import type { AppNotification } from "~/lib/api";
import { subscribeSocketEvent } from "./socket";

export type NotificationStreamEvent =
    | {
          type: "notification";
          notification: AppNotification;
          unreadCount: number;
      }
    | { type: "unread"; unreadCount: number }
    | { type: "reconnected" };

type Handler = (event: NotificationStreamEvent) => void;

interface UserStream {
    handlers: Set<Handler>;
    unsubs: Array<() => void>;
}

const streamsByUser = new Map<string, UserStream>();

/**
 * 订阅指定用户的通知 Socket.IO 流，返回取消订阅函数。
 * 同一用户共享一组监听器，最后一个订阅取消后移除所有监听（底层连接由 socket.ts 引用计数管理）。
 */
export function subscribeNotificationStream(
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

    const unsubNotification = subscribeSocketEvent(
        "notification:new",
        (payload: unknown) => {
            const data = payload as {
                notification: AppNotification;
                unreadCount: number;
            };
            dispatch(stream.handlers, {
                type: "notification",
                notification: data.notification,
                unreadCount: data.unreadCount,
            });
        },
        stream.unsubs.length === 0 ? onConnect : undefined,
    );

    const unsubUnread = subscribeSocketEvent(
        "notification:unread",
        (payload: unknown) => {
            const data = payload as { unreadCount: number };
            dispatch(stream.handlers, {
                type: "unread",
                unreadCount: data.unreadCount,
            });
        },
    );

    stream.unsubs.push(unsubNotification, unsubUnread);
}

function detachStream(userId: string, stream: UserStream): void {
    for (const unsub of stream.unsubs) {
        unsub();
    }
    stream.unsubs = [];
    streamsByUser.delete(userId);
}

function dispatch(
    handlers: Set<Handler>,
    event: NotificationStreamEvent,
): void {
    for (const handler of handlers) {
        handler(event);
    }
}
