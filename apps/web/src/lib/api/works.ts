import { getJson, HttpError, mutateJson, postForm } from "./http";
import type { OwnedWork, Work, WorkDetail, WorkSort } from "./types";

export function worksPath(
    sort: WorkSort,
    limit: number,
    keyword?: string,
): string {
    const base = `/api/works?sort=${sort}&limit=${limit}`;
    return keyword ? `${base}&q=${encodeURIComponent(keyword)}` : base;
}

export function workPath(workId: string): string {
    return `/api/works/${workId}`;
}

export function myWorksPath(): string {
    return "/api/works/mine";
}

/**
 * 「我的作品」的 SWR key。
 * @param userId - 用户 ID，避免切换账号后串数据。
 */
export function myWorksKey(userId: string) {
    return ["my-works", userId] as const;
}

export function fetchWorks(path: string): Promise<Work[]> {
    return getJson<Work[]>(path);
}

export function fetchWork(path: string): Promise<WorkDetail> {
    return getJson<WorkDetail>(path);
}

export function fetchMyWorks(): Promise<OwnedWork[]> {
    return getJson<OwnedWork[]>(myWorksPath());
}

/**
 * multipart 创建作品。
 * @param title - 作品标题。
 * @returns 新作品 ID。
 * @throws 未登录时抛「请先登录」。
 */
export async function createWork(title: string): Promise<{ id: string }> {
    const form = new FormData();
    form.append("title", title);

    const response = await postForm("/api/works", form);
    if (response.status === 401) {
        throw new Error("请先登录");
    }
    if (!response.ok) {
        throw new HttpError(response.status, "创建失败");
    }

    return response.json() as Promise<{ id: string }>;
}

export function updateWorkTitle(
    workId: string,
    title: string,
): Promise<{ id: string; title: string }> {
    return mutateJson(workPath(workId), "PATCH", { title }, "保存标题失败");
}

/**
 * 更新作品元信息（封面）。
 * @param workId - 作品 ID。
 * @param values.coverUrl - 封面公开地址；传 `null` 表示移除封面。
 */
export function updateWorkCover(
    workId: string,
    coverUrl: string | null,
): Promise<{ id: string }> {
    return mutateJson(workPath(workId), "PATCH", { coverUrl }, "保存封面失败");
}

/**
 * 更新作品信息（标题 / 简介 / 标签）。
 * @param workId - 作品 ID。
 * @param values - 需要更新的字段。
 */
export function updateWorkMetadata(
    workId: string,
    values: {
        title?: string;
        description?: string | null;
        tags?: string[];
        coverUrl?: string | null;
    },
): Promise<{ id: string; title?: string }> {
    return mutateJson(workPath(workId), "PATCH", values, "保存作品信息失败");
}

/**
 * 上传作品封面（裁剪后的图片或运行截图），返回公开访问地址。
 * @param file - 封面图片文件。
 */
export async function uploadWorkCover(
    file: File,
): Promise<{ key: string; url: string }> {
    const form = new FormData();
    form.append("file", file);
    const response = await postForm("/api/works/cover", form);
    if (!response.ok) {
        let message = "封面上传失败";
        try {
            const body = (await response.json()) as { error?: string };
            if (body.error) {
                message = body.error;
            }
        } catch {}
        throw new HttpError(response.status, message);
    }
    return (await response.json()) as { key: string; url: string };
}

/**
 * 发布作品为公开状态。
 * @param workId - 作品 ID。
 * @returns 发布结果与作品 ID。
 * @remarks 调用方需失效 `workPath` 缓存。
 */
export function publishWork(
    workId: string,
): Promise<{ ok: boolean; id: string; status: "published" }> {
    return mutateJson(
        `${workPath(workId)}/publish`,
        "POST",
        undefined,
        "发布失败",
    );
}
