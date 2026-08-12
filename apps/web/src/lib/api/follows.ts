import { mutateJson } from "./http";

export function followPath(userId: string): string {
    return `/api/users/${userId}/follow`;
}

/**
 * 关注作者。
 * @param userId - 目标用户 ID。
 * @throws 已关注过时抛 409。
 */
export function followUser(userId: string): Promise<{ following: boolean }> {
    return mutateJson(followPath(userId), "POST", undefined, "关注失败");
}

/**
 * 取消关注作者。
 * @param userId - 目标用户 ID。
 */
export function unfollowUser(userId: string): Promise<{ following: boolean }> {
    return mutateJson(followPath(userId), "DELETE", undefined, "取消关注失败");
}
