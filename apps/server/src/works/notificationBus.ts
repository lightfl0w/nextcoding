import { toNotification } from "./serializers.js";
import {
    countUnreadNotifications,
    listNotifications,
} from "./socialRepository.js";

export type NotificationStreamEvent = {
    type: "notification" | "unread";
    payload: unknown;
};

type Listener = (event: NotificationStreamEvent) => void;

const listenersByUser = new Map<string, Set<Listener>>();

/**
 * 订阅某用户的实时通知事件，返回取消订阅函数。
 */
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

export function publishToUser(
    userId: string,
    event: NotificationStreamEvent,
): void {
    const set = listenersByUser.get(userId);
    if (set) {
        for (const listener of set) {
            listener(event);
        }
    }
}

/**
 * 新通知写入后，推送最新一条通知与最新未读数。
 */
export async function publishNewNotification(userId: string): Promise<void> {
    const [rows, unreadCount] = await Promise.all([
        listNotifications(userId, 1),
        countUnreadNotifications(userId),
    ]);
    const notification = rows[0] ? toNotification(rows[0]) : null;
    if (!notification) {
        return;
    }
    publishToUser(userId, {
        type: "notification",
        payload: { notification, unreadCount },
    });
}

/**
 * 推送最新未读数，供其他设备实时更新。
 */
export function publishUnreadCount(userId: string, unreadCount: number): void {
    publishToUser(userId, { type: "unread", payload: { unreadCount } });
}

/**
 * 全部已读后推送未读数归零，供其他设备实时更新。
 */
export function publishAllRead(userId: string): void {
    publishUnreadCount(userId, 0);
}
