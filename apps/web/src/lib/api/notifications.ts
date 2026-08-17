import { getJson, mutateJson } from "./http";
import type { AppNotification } from "./types";

export function notificationsPath(): string {
    return "/api/notifications";
}

/**
 * 通知列表的 SWR key。
 * @param userId - 用户 ID，避免切换账号后串数据。
 */
export function notificationsKey(userId: string) {
    return ["notifications", userId] as const;
}

/**
 * 未读数的 SWR key。
 * @param userId - 用户 ID，避免切换账号后串数据。
 */
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

export function markNotificationRead(
    id: string,
): Promise<{ ok: boolean; unreadCount: number }> {
    return mutateJson(
        `${notificationsPath()}/${id}/read`,
        "POST",
        undefined,
        "标记已读失败",
    );
}
