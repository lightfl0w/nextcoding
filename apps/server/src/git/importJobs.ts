import { randomUUID } from "node:crypto";
import type { GitImportProgress, GitImportResult } from "./importWork.js";

const JOB_RETENTION_MS = 10 * 60_000;

export type ImportJobStatus = "running" | "done" | "error" | "cancelled";

export interface ImportJob {
    id: string;
    userId: string;
    status: ImportJobStatus;
    percent: number;
    stage: GitImportProgress["stage"] | null;
    message: string;
    result: GitImportResult | null;
    error: string | null;
    controller: AbortController;
    version: number;
    updatedAt: number;
}

const jobs = new Map<string, ImportJob>();

/**
 * 创建导入任务(仅记录状态,由调用方在后台执行导入)。
 * @param userId - 任务归属用户。
 * @returns 任务 ID 与取消信号。
 */
export function createImportJob(userId: string): {
    jobId: string;
    signal: AbortSignal;
} {
    const id = randomUUID();
    const controller = new AbortController();
    jobs.set(id, {
        id,
        userId,
        status: "running",
        percent: 0,
        stage: null,
        message: "等待开始",
        result: null,
        error: null,
        controller,
        version: 0,
        updatedAt: Date.now(),
    });
    return { jobId: id, signal: controller.signal };
}

/**
 * 更新任务进度。
 * @param jobId - 任务 ID。
 * @param progress - 阶段与百分比。
 */
export function updateImportJobProgress(
    jobId: string,
    progress: GitImportProgress,
): void {
    const job = jobs.get(jobId);
    if (job?.status !== "running") {
        return;
    }
    job.percent = progress.percent;
    job.stage = progress.stage;
    job.message = progress.message;
    job.version += 1;
    job.updatedAt = Date.now();
}

/**
 * 标记任务成功。
 * @param jobId - 任务 ID。
 * @param result - 导入结果。
 */
export function finishImportJob(jobId: string, result: GitImportResult): void {
    const job = jobs.get(jobId);
    if (job?.status !== "running") {
        return;
    }
    job.status = "done";
    job.percent = 100;
    job.message = "导入完成";
    job.result = result;
    job.version += 1;
    job.updatedAt = Date.now();
}

/**
 * 标记任务失败。
 * @param jobId - 任务 ID。
 * @param error - 错误消息。
 */
export function failImportJob(jobId: string, error: string): void {
    const job = jobs.get(jobId);
    if (job?.status !== "running") {
        return;
    }
    job.status = "error";
    job.error = error;
    job.message = error;
    job.version += 1;
    job.updatedAt = Date.now();
}

/**
 * 取消任务：触发中止信号并标记为已取消（仅运行中生效）。
 * @param jobId - 任务 ID。
 * @returns 是否成功取消（任务存在且处于运行中）。
 */
export function cancelImportJob(jobId: string): boolean {
    const job = jobs.get(jobId);
    if (job?.status !== "running") {
        return false;
    }
    job.controller.abort();
    job.status = "cancelled";
    job.message = "导入已取消";
    job.version += 1;
    job.updatedAt = Date.now();
    return true;
}

/**
 * 读取任务;顺带清理过期任务。
 * @param jobId - 任务 ID。
 * @returns 任务;不存在返回 `null`。
 */
export function getImportJob(jobId: string): ImportJob | null {
    const job = jobs.get(jobId);
    if (!job) {
        return null;
    }
    if (
        job.status !== "running" &&
        Date.now() - job.updatedAt > JOB_RETENTION_MS
    ) {
        jobs.delete(jobId);
        return null;
    }
    return job;
}
