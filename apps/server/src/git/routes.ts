import { rm } from "node:fs/promises";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AuthenticatedEnv } from "../http/guards.js";
import { requireSession } from "../http/guards.js";
import {
    jsonError,
    readFlag,
    readJsonBody,
    readString,
    readTrimmed,
} from "../http/responses.js";
import { requireWorkAuthor } from "../works/guards.js";
import {
    buildGitRepository,
    collectWorkCommits,
    zipDirectory,
} from "./exportWork.js";
import {
    cancelImportJob,
    createImportJob,
    failImportJob,
    finishImportJob,
    getImportJob,
    updateImportJobProgress,
} from "./importJobs.js";
import { GitImportError, importWorkFromGit } from "./importWork.js";
import { GitPushError, pushWorkToGit } from "./pushWork.js";

const IMPORT_EVENT_TIMEOUT_MS = 15 * 60_000;

export const gitRoutes = new Hono<AuthenticatedEnv>();

gitRoutes.post("/import/git", requireSession, async (c) => {
    const body = await readJsonBody(c);
    const repoUrl = readString(body, "repoUrl");
    if (!repoUrl) {
        return jsonError(c, "缺少仓库地址", 400);
    }
    const depthInput = body.depth;
    const depthRaw =
        typeof depthInput === "number"
            ? depthInput
            : Number(readString(body, "depth"));
    const depth =
        Number.isInteger(depthRaw) && depthRaw >= 1 ? depthRaw : undefined;

    const userId = c.get("userId");
    const { jobId, signal } = createImportJob(userId);
    void importWorkFromGit({
        repoUrl,
        userId,
        ref: readTrimmed(body, "ref") || undefined,
        depth,
        title: readTrimmed(body, "title") || undefined,
        signal,
        onProgress: (progress) => updateImportJobProgress(jobId, progress),
    }).then(
        (result) => finishImportJob(jobId, result),
        (error) =>
            failImportJob(
                jobId,
                error instanceof GitImportError
                    ? error.message
                    : `导入失败：${errorMessage(error)}`,
            ),
    );
    return c.json({ jobId }, 202);
});

/**
 * 取消导入任务（仅运行中可取消；任务归属用户可操作）。
 * @remarks 页面关闭/主动取消时调用，触发中止信号停止后台导入。
 */
gitRoutes.post("/import/git/jobs/:jobId/cancel", requireSession, async (c) => {
    const jobId = c.req.param("jobId");
    const job = getImportJob(jobId);
    if (!job) {
        return jsonError(c, "任务不存在或已过期", 404);
    }
    if (job.userId !== c.get("userId")) {
        return jsonError(c, "无权操作", 403);
    }
    const cancelled = cancelImportJob(jobId);
    return c.json({ ok: true, cancelled, jobId });
});

/**
 * 导入任务进度事件流(SSE)。
 * @remarks 推送 `progress`(进行中)/`done`(含结果)/`error`(失败)事件;仅任务归属用户可订阅。
 */
gitRoutes.get("/import/git/jobs/:jobId/events", requireSession, async (c) => {
    const jobId = c.req.param("jobId");
    const userId = c.get("userId");
    const deadline = Date.now() + IMPORT_EVENT_TIMEOUT_MS;

    return streamSSE(c, async (stream) => {
        let lastVersion = -1;
        while (!stream.aborted) {
            const job = getImportJob(jobId);
            if (!job) {
                await stream.writeSSE({
                    event: "error",
                    data: JSON.stringify({ message: "任务不存在或已过期" }),
                });
                return;
            }
            if (job.userId !== userId) {
                await stream.writeSSE({
                    event: "error",
                    data: JSON.stringify({ message: "无权查看该任务" }),
                });
                return;
            }
            if (job.version !== lastVersion) {
                lastVersion = job.version;
                const event =
                    job.status === "done"
                        ? "done"
                        : job.status === "error"
                          ? "error"
                          : job.status === "cancelled"
                            ? "cancelled"
                            : "progress";
                await stream.writeSSE({
                    event,
                    data: JSON.stringify({
                        status: job.status,
                        percent: job.percent,
                        stage: job.stage,
                        message: job.message,
                        result: job.result,
                        error: job.error,
                    }),
                });
                if (job.status !== "running") {
                    return;
                }
            }
            if (Date.now() > deadline) {
                await stream.writeSSE({
                    event: "error",
                    data: JSON.stringify({ message: "导入超时" }),
                });
                return;
            }
            await stream.sleep(500);
        }
    });
});

gitRoutes.get("/:id/export/git", requireWorkAuthor, async (c) => {
    const workId = c.req.param("id");
    try {
        const commits = await collectWorkCommits(workId);
        const dir = await buildGitRepository(commits);
        let zip: ArrayBuffer;
        try {
            zip = await zipDirectory(dir);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
        c.header("Content-Type", "application/zip");
        c.header(
            "Content-Disposition",
            `attachment; filename="work-${workId}.git.zip"`,
        );
        return c.body(zip);
    } catch (error) {
        return jsonError(c, `导出失败：${errorMessage(error)}`, 500);
    }
});

gitRoutes.post("/:id/export/git/push", requireWorkAuthor, async (c) => {
    const workId = c.req.param("id");
    const body = await readJsonBody(c);
    const url = readString(body, "url");
    const token = readString(body, "token");
    if (!url || !token) {
        return jsonError(c, "缺少远程仓库地址或访问令牌", 400);
    }
    try {
        const result = await pushWorkToGit({
            workId,
            url,
            token,
            ref: readTrimmed(body, "ref") || undefined,
            force: readFlag(body, "force"),
        });
        return c.json(result);
    } catch (error) {
        if (error instanceof GitPushError) {
            return jsonError(c, error.message, error.status);
        }
        return jsonError(c, `推送失败：${errorMessage(error)}`, 500);
    }
});

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
