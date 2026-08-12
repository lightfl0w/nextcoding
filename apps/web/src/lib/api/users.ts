import { getJson } from "./http";

export interface MyStats {
    givenSparks: number;
    receivedSparks: number;
}

export function myStatsPath(): string {
    return "/api/users/me/stats";
}

/**
 * 当前用户的火花统计。
 * @returns 送出的与收到的火花数。
 */
export function fetchMyStats(): Promise<MyStats> {
    return getJson<MyStats>(myStatsPath());
}
