import { getJson, HttpError, postForm } from "./http";
import type { UserProfile, Work } from "./types";

export interface MyStats {
    givenSparks: number;
    receivedSparks: number;
}

export interface UploadedAvatar {
    key: string;
    url: string;
}

export function myStatsPath(): string {
    return "/api/users/me/stats";
}

/**
 * 公开用户资料的请求路径。
 * @param userId - 目标用户 ID。
 */
export function userPath(userId: string): string {
    return `/api/users/${userId}`;
}

/**
 * 某用户已发布作品的请求路径。
 * @param userId - 目标用户 ID。
 * @param limit - 数量上限。
 */
export function userWorksPath(userId: string, limit: number): string {
    return `/api/users/${userId}/works?limit=${limit}`;
}

/**
 * 当前用户的火花统计。
 * @returns 送出的与收到的火花数。
 */
export function fetchMyStats(): Promise<MyStats> {
    return getJson<MyStats>(myStatsPath());
}

/**
 * 获取某用户的公开资料。
 * @param userId - 目标用户 ID。
 * @throws 用户不存在时抛 404 的 {@link HttpError}。
 */
export function fetchUser(userId: string): Promise<UserProfile> {
    return getJson<UserProfile>(userPath(userId));
}

/**
 * 获取某用户已发布的作品。
 * @param userId - 目标用户 ID。
 * @param limit - 数量上限。
 */
export function fetchUserWorks(userId: string, limit: number): Promise<Work[]> {
    return getJson<Work[]>(userWorksPath(userId, limit));
}

function avatarUploadPath(): string {
    return "/api/users/me/avatar";
}

/**
 * 上传头像。
 * @param file - 要上传的图片文件。
 * @returns 上传成功后返回头像的 key 和可访问的 url。
 * @throws {@link HttpError} 请求失败时抛出，status 指示错误类型：
 *   - 400: 格式/大小不合法或表单缺失
 *   - 401: 未登录
 */
export async function uploadAvatar(file: File): Promise<UploadedAvatar> {
    const form = new FormData();
    form.append("file", file);
    const response = await postForm(avatarUploadPath(), form);
    if (!response.ok) {
        let message = "上传失败";
        try {
            const body = (await response.json()) as { error?: string };
            if (body.error) {
                message = body.error;
            }
        } catch {
            void response;
        }
        throw new HttpError(response.status, message);
    }
    return (await response.json()) as UploadedAvatar;
}
