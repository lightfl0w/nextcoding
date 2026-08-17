import { mutateJson } from "./http";

export interface GitImportInput {
    repoUrl: string;
    ref?: string;
    depth?: number;
    title?: string;
}

export interface GitImportResult {
    workId: string;
    title: string;
    commitCount: number;
    fileCount: number;
    skipped: Array<{ path: string; reason: string }>;
}

export interface GitPushInput {
    url: string;
    token: string;
    ref?: string;
    force?: boolean;
}

export interface GitPushResult {
    ok: true;
    pushedRef: string;
    commitCount: number;
}

export interface GitImportJobStart {
    jobId: string;
}

export type GitImportJobStatus = "running" | "done" | "error" | "cancelled";

export interface GitImportJobEvent {
    status: GitImportJobStatus;
    percent: number;
    stage: "cloning" | "reading" | "writing" | "finalizing" | null;
    message: string;
    result: GitImportResult | null;
    error: string | null;
}

/**
 * 启动 Git 仓库导入（异步任务）。
 * @param input - 仓库地址与可选分支/标题。
 * @returns 任务 ID，用于订阅进度事件流。
 */
export function startGitImport(
    input: GitImportInput,
): Promise<GitImportJobStart> {
    return mutateJson<GitImportJobStart>(
        "/api/works/import/git",
        "POST",
        input,
        "导入 Git 仓库失败",
    );
}

/**
 * 导入任务进度事件流地址（SSE）。
 * @param jobId - 任务 ID。
 * @returns 可直接传给 `EventSource` 的地址。
 */
export function gitImportJobEventsUrl(jobId: string): string {
    return `/api/works/import/git/jobs/${jobId}/events`;
}

/**
 * 取消导入任务。
 * @param jobId - 任务 ID。
 * @returns 取消结果（`cancelled` 表示确实在运行中被取消）。
 */
export function cancelGitImport(
    jobId: string,
): Promise<{ ok: boolean; cancelled: boolean; jobId: string }> {
    return mutateJson(
        `/api/works/import/git/jobs/${jobId}/cancel`,
        "POST",
        undefined,
        "取消失败",
    );
}

/**
 * 页面卸载/关闭时取消导入任务。
 * @param jobId - 任务 ID。
 * @remarks 用 keepalive 请求，浏览器卸载页面时仍能送达。
 */
export function cancelGitImportOnUnload(jobId: string): void {
    void fetch(`/api/works/import/git/jobs/${jobId}/cancel`, {
        method: "POST",
        keepalive: true,
    });
}

/**
 * 把作品导出为 Git 仓库 zip 并触发浏览器下载。
 * @param workId - 作品 ID。
 * @param filename - 下载文件名；缺省用作品 ID 生成。
 */
export async function downloadWorkAsGit(
    workId: string,
    filename?: string,
): Promise<void> {
    const response = await fetch(`/api/works/${workId}/export/git`);
    if (!response.ok) {
        let message = "导出失败";
        try {
            const body = await response.json();
            if (typeof body === "object" && body !== null && "error" in body) {
                message = body.error as string;
            }
        } catch {}
        throw new Error(message);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename ?? `work-${workId}.git.zip`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    } finally {
        URL.revokeObjectURL(url);
    }
}

/**
 * 把作品版本历史推送到远程仓库。
 * @param workId - 作品 ID。
 * @param input - 远程地址、令牌与可选分支。
 * @returns 推送结果。
 */
export function pushWorkToGit(
    workId: string,
    input: GitPushInput,
): Promise<GitPushResult> {
    return mutateJson<GitPushResult>(
        `/api/works/${workId}/export/git/push`,
        "POST",
        input,
        "推送失败",
    );
}
