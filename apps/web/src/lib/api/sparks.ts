import { getJson, mutateJson } from "./http";

export function workSparkPath(workId: string): string {
    return `/api/works/${workId}/spark`;
}

/**
 * 当前用户是否已给作品送过火花。
 * @param workId - 作品 ID。
 */
export function fetchWorkSpark(workId: string): Promise<{ sparked: boolean }> {
    return getJson<{ sparked: boolean }>(workSparkPath(workId));
}

/**
 * 送火花。
 * @param workId - 作品 ID。
 * @throws 已送过时抛 409。
 */
export function giveSpark(workId: string): Promise<{ sparked: boolean }> {
    return mutateJson(workSparkPath(workId), "POST", undefined, "送火花失败");
}
