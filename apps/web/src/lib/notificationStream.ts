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

const handlers = new Set<Handler>();
let source: EventSource | null = null;

/**
 * 订阅通知 SSE 流，返回取消订阅函数。
 * 首个订阅建立连接，最后一个订阅取消后断开连接。
 */
export function subscribeNotificationStream(handler: Handler): () => void {
    handlers.add(handler);
    openStream();
    return () => {
        handlers.delete(handler);
        if (handlers.size === 0) {
            closeStream();
        }
    };
}

function openStream(): void {
    if (source) {
        return;
    }
    const es = new EventSource(notificationsStreamPath());
    source = es;
    es.addEventListener("notification", (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
            notification: AppNotification;
            unreadCount: number;
        };
        dispatch({
            type: "notification",
            notification: payload.notification,
            unreadCount: payload.unreadCount,
        });
    });
    es.addEventListener("unread", (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
            unreadCount: number;
        };
        dispatch({ type: "unread", unreadCount: payload.unreadCount });
    });
    es.addEventListener("open", () => {
        dispatch({ type: "reconnected" });
    });
}

function closeStream(): void {
    source?.close();
    source = null;
}

function dispatch(event: NotificationStreamEvent): void {
    for (const handler of handlers) {
        handler(event);
    }
}
