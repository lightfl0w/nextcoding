import type { AppNotification } from "./api";

export type NotificationFilter = "all" | "unread";
export type NotificationTypeFilter = "all" | "spark" | "remix";

export type NotificationGroup = {
    key: string;
    label: string;
    items: AppNotification[];
};

export type NotificationCounts = {
    total: number;
    unread: number;
    spark: number;
    remix: number;
    sparkUnread: number;
    remixUnread: number;
};

/**
 * 通知文案。
 * @param item - 通知数据。
 * @returns 火花与二创两种类型的文案。
 */
export function notificationText(item: AppNotification): string {
    const actor = item.actor?.name ?? "某位用户";
    const workTitle = item.work?.title ?? "你的作品";
    if (item.type === "spark") {
        return `${actor} 给你的作品《${workTitle}》送了一个火花`;
    }
    return `${actor} 二创了你的作品《${workTitle}》，快去看看吧`;
}

export function formatTimeOfDay(timestamp: number | string | Date): string {
    const date = new Date(timestamp);
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
}

/**
 * 按时间分组。
 * @param items - 通知列表。
 * @returns 今天/昨天/本周/更早 四组，空组不输出。
 */
export function groupNotifications(
    items: AppNotification[],
): NotificationGroup[] {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 6);

    const todayItems: AppNotification[] = [];
    const yesterdayItems: AppNotification[] = [];
    const weekItems: AppNotification[] = [];
    const earlierItems: AppNotification[] = [];

    for (const item of items) {
        const d = new Date(item.createdAt);
        if (d >= today) {
            todayItems.push(item);
        } else if (d >= yesterday) {
            yesterdayItems.push(item);
        } else if (d >= weekAgo) {
            weekItems.push(item);
        } else {
            earlierItems.push(item);
        }
    }

    const groups: NotificationGroup[] = [];
    if (todayItems.length > 0) {
        groups.push({ key: "today", label: "今天", items: todayItems });
    }
    if (yesterdayItems.length > 0) {
        groups.push({ key: "yesterday", label: "昨天", items: yesterdayItems });
    }
    if (weekItems.length > 0) {
        groups.push({ key: "week", label: "本周", items: weekItems });
    }
    if (earlierItems.length > 0) {
        groups.push({ key: "earlier", label: "更早", items: earlierItems });
    }
    return groups;
}
