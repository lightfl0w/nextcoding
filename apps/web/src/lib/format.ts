/**
 * 数字缩写。
 * @param count - 原始数值。
 * @returns ≥1 万时显示为 `x.xw`。
 */
export function formatCount(count: number) {
    return count >= 10000 ? `${(count / 10000).toFixed(1)}w` : String(count);
}

/**
 * 格式化时间。
 * @param timestamp - 时间戳或日期。
 */
export function formatDate(timestamp: number | string | Date) {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - date.getTime();

    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < minute) {
        return "刚刚";
    }
    if (diff < hour) {
        return `${Math.floor(diff / minute)} 分钟前`;
    }
    if (diff < day) {
        return `${Math.floor(diff / hour)} 小时前`;
    }
    if (diff < 7 * day) {
        return `${Math.floor(diff / day)} 天前`;
    }

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/**
 * 格式化钟表时间(消息气泡头部用)。
 * @param timestamp - 时间戳或日期。
 * @returns `HH:MM`。
 */
export function formatTime(timestamp: number | string | Date) {
    const date = new Date(timestamp);
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
}
