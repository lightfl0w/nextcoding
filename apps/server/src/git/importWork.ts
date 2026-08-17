import { createHash } from "node:crypto";
import fs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import type { ErrorStatus } from "../http/responses.js";
import { getStorage } from "../storage/storageClient.js";
import {
    exceedsFileSizeLimit,
    GIT_IMPORT_MAX_COMMITS,
    GIT_IMPORT_MAX_FILES,
    GIT_IMPORT_MAX_TOTAL_BYTES,
} from "../works/limits.js";
import {
    blobStorageKey,
    fileStorageKey,
    snapshotStorageKey,
} from "../works/naming.js";
import {
    insertVersion,
    insertWork,
    insertWorkFiles,
} from "../works/repository.js";
import { type Snapshot, serializeSnapshot } from "../works/snapshot.js";
import { validatePublicGitUrl } from "./safeUrl.js";

export interface GitImportOptions {
    repoUrl: string;
    userId: string;
    ref?: string;
    depth?: number;
    title?: string;
    onProgress?: (progress: GitImportProgress) => void;
    signal?: AbortSignal;
}

/**
 * 导入进度回调事件。
 * @param stage - 阶段。
 * @param percent - 0-100。
 * @param message - 人类可读的阶段描述。
 */
export interface GitImportProgress {
    stage: "cloning" | "reading" | "writing" | "finalizing";
    percent: number;
    message: string;
}

export interface GitImportResult {
    workId: string;
    title: string;
    commitCount: number;
    fileCount: number;
    skipped: Array<{ path: string; reason: string }>;
}

export class GitImportError extends Error {
    readonly status: ErrorStatus;

    constructor(message: string, status: ErrorStatus = 400) {
        super(message);
        this.status = status;
    }
}

interface ImportedFile {
    name: string;
    bytes: Uint8Array;
}

interface PendingVersion {
    version: number;
    snapshotKey: string;
    message: string;
    createdAt: Date;
    entries: Array<{
        key: string;
        name: string;
        contentType: string | null;
        size: number;
        hash: string;
    }>;
}

/**
 * 从公网 Git 仓库导入作品。
 * @param options.repoUrl - http/https 仓库地址。
 * @param options.userId - 导入者,作为作品作者与版本提交者。
 * @param options.ref - 可选分支/标签;缺省为仓库默认分支。
 * @param options.depth - 导入的提交深度上限。
 * @param options.title - 可选作品标题;缺省取仓库名。
 * @param options.onProgress - 可选进度回调,各阶段推进时调用。
 * @returns 新作品信息与导入统计。
 * @remarks 每个提交生成一个作品版本(内容按 sha256 去重写入 blob),HEAD 文件成为当前作品文件。
 */
export async function importWorkFromGit(
    options: GitImportOptions,
): Promise<GitImportResult> {
    const { onProgress } = options;
    const progress = (
        stage: GitImportProgress["stage"],
        percent: number,
        message: string,
    ) => {
        onProgress?.({ stage, percent, message });
    };
    const throwIfAborted = () => {
        if (options.signal?.aborted) {
            throw new GitImportError("导入已取消", 400);
        }
    };

    throwIfAborted();
    const validation = await validatePublicGitUrl(options.repoUrl);
    if (validation) {
        throw new GitImportError(validation);
    }

    const depth = clampDepth(options.depth);
    const title = options.title?.trim() || repoNameFromUrl(options.repoUrl);
    const workId = crypto.randomUUID();
    const storage = getStorage();

    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "nextcoding-git-"));
    try {
        throwIfAborted();
        progress("cloning", 5, "正在克隆仓库");
        await git.clone({
            fs,
            http,
            dir: tmpDir,
            url: options.repoUrl,
            ref: options.ref,
            depth,
            singleBranch: true,
        });
        throwIfAborted();
        progress("cloning", 20, "克隆仓库完成");

        let commits: ReadonlyArray<{
            oid: string;
            commit: {
                message: string;
                tree: string;
                committer?: { timestamp?: number };
            };
        }> = [];
        try {
            commits = await git.log({ fs, dir: tmpDir, depth });
        } catch (error) {
            throw new GitImportError(
                `读取提交历史失败：${errorMessage(error)}`,
                500,
            );
        }
        if (commits.length === 0) {
            throw new GitImportError("仓库没有可导入的提交");
        }
        progress("reading", 25, `读取到 ${commits.length} 个提交`);

        const ordered = commits.slice(0, depth).reverse();
        const versions: PendingVersion[] = [];
        const skipped: Array<{ path: string; reason: string }> = [];
        let fileCount = 0;
        let totalBytes = 0;
        const headBytes: ImportedFile[] = [];

        for (const [index, commit] of ordered.entries()) {
            throwIfAborted();
            const commitFiles: ImportedFile[] = [];
            await walkTree(tmpDir, commit.commit.tree, "", commitFiles);
            const entries: PendingVersion["entries"] = [];
            const headTarget = index === ordered.length - 1;

            for (const file of commitFiles) {
                throwIfAborted();
                const reason = importLimitReason(
                    file.bytes.byteLength,
                    fileCount,
                    totalBytes,
                );
                if (reason) {
                    skipped.push({ path: file.name, reason });
                    continue;
                }
                const hash = sha256Hex(file.bytes);
                const contentType = contentTypeFromName(file.name);
                await storage.put(blobStorageKey(workId, hash), file.bytes, {
                    contentType: contentType ?? undefined,
                });
                entries.push({
                    key: fileStorageKey(workId, file.name),
                    name: file.name,
                    contentType,
                    size: file.bytes.byteLength,
                    hash,
                });
                fileCount += 1;
                totalBytes += file.bytes.byteLength;
                if (headTarget) {
                    headBytes.push(file);
                }
            }

            const version = index + 1;
            const createdAt = new Date(
                (commit.commit.committer?.timestamp ?? 0) * 1000,
            );
            const snapshot: Snapshot = {
                version,
                message: commit.commit.message,
                createdAt: createdAt.getTime(),
                files: entries,
            };
            const snapshotKey = snapshotStorageKey(workId, version);
            await storage.put(snapshotKey, serializeSnapshot(snapshot), {
                contentType: "application/json",
            });
            versions.push({
                version,
                snapshotKey,
                message: commit.commit.message,
                createdAt,
                entries,
            });
            progress(
                "writing",
                25 + Math.round(((index + 1) / ordered.length) * 60),
                `正在写入文件（${index + 1}/${ordered.length} 个提交）`,
            );
        }

        if (versions.length === 0) {
            throw new GitImportError("仓库没有可导入的提交");
        }

        throwIfAborted();
        progress("finalizing", 90, "正在保存作品");
        await insertWork({
            id: workId,
            userId: options.userId,
            title,
            description: null,
            tags: "[]",
            status: "draft",
        });

        for (const version of versions) {
            await insertVersion({
                workId,
                version: version.version,
                snapshotKey: version.snapshotKey,
                message: version.message,
                userId: options.userId,
                createdAt: version.createdAt,
            });
        }

        await Promise.all(
            headBytes.map((file) =>
                storage.put(fileStorageKey(workId, file.name), file.bytes, {
                    contentType: contentTypeFromName(file.name) ?? undefined,
                }),
            ),
        );
        await insertWorkFiles(
            headBytes.map((file) => ({
                workId,
                key: fileStorageKey(workId, file.name),
                name: file.name,
                size: file.bytes.byteLength,
                contentType: contentTypeFromName(file.name),
            })),
        );
        progress("finalizing", 100, "导入完成");

        return {
            workId,
            title,
            commitCount: versions.length,
            fileCount: headBytes.length,
            skipped,
        };
    } catch (error) {
        if (error instanceof GitImportError) {
            throw error;
        }
        throw new GitImportError(`导入失败：${errorMessage(error)}`, 500);
    } finally {
        await rm(tmpDir, { recursive: true, force: true });
    }
}

async function walkTree(
    dir: string,
    treeOid: string,
    prefix: string,
    files: ImportedFile[],
): Promise<void> {
    const result = await git.readTree({ fs, dir, oid: treeOid });
    for (const entry of result.tree) {
        const name = prefix ? `${prefix}/${entry.path}` : entry.path;
        if (entry.type === "tree") {
            await walkTree(dir, entry.oid, name, files);
        } else if (entry.type === "blob") {
            const { blob } = await git.readBlob({ fs, dir, oid: entry.oid });
            files.push({ name, bytes: new Uint8Array(blob) });
        }
    }
}

function importLimitReason(
    byteLength: number,
    fileCount: number,
    totalBytes: number,
): string | null {
    if (exceedsFileSizeLimit(byteLength)) {
        return "超过单文件大小限制";
    }
    if (fileCount >= GIT_IMPORT_MAX_FILES) {
        return "超过导入文件数上限";
    }
    if (totalBytes + byteLength > GIT_IMPORT_MAX_TOTAL_BYTES) {
        return "超过导入总大小上限";
    }
    return null;
}

function clampDepth(raw: number | undefined): number {
    if (raw === undefined || !Number.isInteger(raw) || raw < 1) {
        return GIT_IMPORT_MAX_COMMITS;
    }
    return Math.min(raw, GIT_IMPORT_MAX_COMMITS);
}

function repoNameFromUrl(url: string): string {
    try {
        const parsed = new URL(url);
        const last = parsed.pathname.replace(/\/+$/, "").split("/").pop();
        return last?.replace(/\.git$/i, "") || "未命名作品";
    } catch {
        return "未命名作品";
    }
}

function sha256Hex(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex");
}

function contentTypeFromName(name: string): string | null {
    const ext = name.includes(".")
        ? name.slice(name.lastIndexOf(".") + 1).toLowerCase()
        : "";
    return CONTENT_TYPE_BY_EXT[ext] ?? null;
}

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
    js: "text/javascript",
    mjs: "text/javascript",
    cjs: "text/javascript",
    jsx: "text/javascript",
    ts: "text/typescript",
    tsx: "text/typescript",
    mts: "text/typescript",
    cts: "text/typescript",
    json: "application/json",
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    md: "text/markdown",
    txt: "text/plain",
    py: "text/x-python",
    sh: "text/x-shellscript",
    yml: "text/yaml",
    yaml: "text/yaml",
    xml: "text/xml",
    csv: "text/csv",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    ico: "image/x-icon",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    pdf: "application/pdf",
    zip: "application/zip",
    gz: "application/gzip",
    wasm: "application/wasm",
    cs: "text/plain",
    java: "text/plain",
    php: "text/plain",
    dart: "text/plain",
    go: "text/plain",
    rs: "text/plain",
    rb: "text/plain",
};

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
