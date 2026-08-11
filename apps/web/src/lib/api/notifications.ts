import { getJson, mutateJson } from "./http";
import type { AppNotification } from "./types";

export function notificationsPath(): string {
    return "/api/notifications";
}

export function notificationsKey(userId: string) {
    return ["notifications", userId] as const;
}

export function unreadCountKey(userId: string) {
    return ["notification-unread", userId] as const;
}

export function fetchNotifications(): Promise<AppNotification[]> {
    return getJson<AppNotification[]>(notificationsPath());
}

export function fetchUnreadCount(): Promise<{ count: number }> {
    return getJson<{ count: number }>(`${notificationsPath()}/unread-count`);
}

export function markNotificationsRead(): Promise<{ ok: boolean }> {
    return mutateJson(
        `${notificationsPath()}/read-all`,
        "POST",
        undefined,
        "标记已读失败",
    );
}
