import { getJson, HttpError, postForm } from "./http";

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
 * 当前用户的火花统计。
 * @returns 送出的与收到的火花数。
 */
export function fetchMyStats(): Promise<MyStats> {
    return getJson<MyStats>(myStatsPath());
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
