import { getJson, HttpError, mutateJson, postForm } from "./http";
import type { OwnedWork, Work, WorkDetail, WorkSort } from "./types";

/**
 * 基于作品的模板创建草稿。
 * @param workId - 开放为模板的作品 ID。
 * @returns 新草稿信息。
 */
export async function applyWorkTemplate(
    workId: string,
): Promise<{ id: string; title: string; files: number }> {
    return mutateJson(
        `/api/works/${workId}/use-template`,
        "POST",
        undefined,
        "使用模板失败",
    );
}

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
