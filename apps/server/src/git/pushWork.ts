import fs from "node:fs";
import { rm } from "node:fs/promises";
import * as git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import type { ErrorStatus } from "../http/responses.js";
import { buildGitRepository, collectWorkCommits } from "./exportWork.js";
import { validatePublicGitUrl } from "./safeUrl.js";

export interface PushWorkOptions {
    workId: string;
    url: string;
    token: string;
    ref?: string;
    force?: boolean;
}

export class GitPushError extends Error {
    readonly status: ErrorStatus;

    constructor(message: string, status: ErrorStatus = 400) {
        super(message);
        this.status = status;
    }
}

/**
 * 把作品版本历史推送到远程仓库。
 * @param options.workId - 作品 ID。
 * @param options.url - 远程 http/https 仓库地址。
 * @param options.token - 访问令牌(仅本次请求内使用)。
 * @param options.ref - 目标分支;缺省推送当前分支。
 * @param options.force - 是否强制推送(覆盖远端不同历史)。
 * @returns 推送结果。
 */
export async function pushWorkToGit(
    options: PushWorkOptions,
): Promise<{ ok: true; pushedRef: string; commitCount: number }> {
    const validation = await validatePublicGitUrl(options.url);
    if (validation) {
        throw new GitPushError(validation);
    }

    const commits = await collectWorkCommits(options.workId);
    const dir = await buildGitRepository(commits);
    const pushedRef = options.ref || "HEAD";
    try {
        await git.push({
            fs,
            http,
            dir,
            remote: "origin",
            url: options.url,
            ref: pushedRef,
            force: options.force ?? false,
            onAuth: () => ({
                username: options.token,
                password: options.token,
            }),
        });
        return { ok: true, pushedRef, commitCount: commits.length };
    } catch (error) {
        throw new GitPushError(`推送失败：${errorMessage(error)}`, 500);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
