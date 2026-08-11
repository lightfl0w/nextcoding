import { getJson, HttpError, mutateJson, postForm } from "./http";
import type { OwnedWork, Work, WorkDetail, WorkSort } from "./types";

export function worksPath(sort: WorkSort, limit: number): string {
    return `/api/works?sort=${sort}&limit=${limit}`;
}

export function workPath(workId: string): string {
    return `/api/works/${workId}`;
}

export function myWorksPath(): string {
    return "/api/works/mine";
}

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
