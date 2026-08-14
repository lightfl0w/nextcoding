import type { AppNotification } from "~/lib/api";
import { notificationsStreamPath } from "~/lib/api";

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
    source: EventSource | null;
}

const streamsByUser = new Map<string, UserStream>();

/**
 * 订阅指定用户的通知 SSE 流，返回取消订阅函数。
 * 同一用户共享一条连接，最后一个订阅取消后断开连接。
 * SSE 连接在建立时按会话绑定用户，因此连接按用户隔离；
 * 切换账号后新用户的订阅会建立新连接，不会复用原用户的连接。
 */
export function subscribeNotificationStream(
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
    const es = new EventSource(notificationsStreamPath());
    stream.source = es;
    es.addEventListener("notification", (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
            notification: AppNotification;
            unreadCount: number;
        };
        dispatch(stream.handlers, {
            type: "notification",
            notification: payload.notification,
            unreadCount: payload.unreadCount,
        });
    });
    es.addEventListener("unread", (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
            unreadCount: number;
        };
        dispatch(stream.handlers, {
            type: "unread",
            unreadCount: payload.unreadCount,
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

function dispatch(
    handlers: Set<Handler>,
    event: NotificationStreamEvent,
): void {
    for (const handler of handlers) {
        handler(event);
    }
}
