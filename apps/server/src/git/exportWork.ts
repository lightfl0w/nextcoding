import fs from "node:fs";
import {
    mkdir,
    mkdtemp,
    readdir,
    readFile,
    rm,
    writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { type Zippable, zipSync } from "fflate";
import * as git from "isomorphic-git";
import { getStorage } from "../storage/storageClient.js";
import {
    findVersion,
    findWorkAuthor,
    listVersionSummaries,
    listWorkFiles,
} from "../works/repository.js";
import {
    parseSnapshot,
    resolveSnapshotFileBytes,
    snapshotFilesOf,
} from "../works/snapshot.js";

export interface GitCommitInput {
    version: number;
    message: string;
    createdAt: number;
    authorName: string;
    authorEmail: string;
    files: Array<{ name: string; bytes: Uint8Array }>;
}

/**
 * 把作品的版本历史收集为 Git 提交序列。
 * @param workId - 作品 ID。
 * @returns 按版本升序排列的提交;作品没有版本时,以当前文件生成单个提交。
 */
export async function collectWorkCommits(
    workId: string,
): Promise<GitCommitInput[]> {
    const storage = getStorage();
    const owner = await findWorkAuthor(workId);
    const ownerName = owner?.name ?? "unknown";
    const ownerEmail =
        owner?.email ?? `${owner?.id ?? "unknown"}@nextcoding.local`;

    const summaries = await listVersionSummaries(workId, 10000);
    if (summaries.length === 0) {
        const files = await listWorkFiles(workId);
        const loaded: GitCommitInput["files"] = [];
        for (const file of files) {
            const data = await storage.get(file.key);
            loaded.push({ name: file.name, bytes: data ?? new Uint8Array(0) });
        }
        return [
            {
                version: 1,
                message: "当前文件",
                createdAt: Date.now(),
                authorName: ownerName,
                authorEmail: ownerEmail,
                files: loaded,
            },
        ];
    }

    const commits: GitCommitInput[] = [];
    for (const summary of [...summaries].reverse()) {
        const row = await findVersion(workId, summary.version);
        if (!row) {
            continue;
        }
        const raw = await storage.get(row.snapshotKey);
        if (!raw) {
            continue;
        }
        const snapshot = parseSnapshot(raw);
        const files: GitCommitInput["files"] = [];
        for (const file of snapshotFilesOf(snapshot)) {
            files.push({
                name: file.name,
                bytes: await resolveSnapshotFileBytes(workId, file),
            });
        }
        commits.push({
            version: summary.version,
            message: summary.message ?? `v${summary.version}`,
            createdAt: summary.createdAt.getTime(),
            authorName: summary.authorName ?? ownerName,
            authorEmail: summary.authorId
                ? `${summary.authorId}@nextcoding.local`
                : ownerEmail,
            files,
        });
    }
    return commits;
}

/**
 * 在临时目录中构建完整 Git 仓库(工作区 + .git 历史)。
 * @param commits - 按时间升序的提交序列。
 * @returns 仓库目录,调用方负责清理。
 * @remarks 每个版本对应一个提交:文件写入工作区后 `add` + `commit`,作者与提交时间取自版本记录。
 */
export async function buildGitRepository(
    commits: GitCommitInput[],
): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), "nextcoding-git-export-"));
    try {
        await git.init({ fs, dir, defaultBranch: "main" });
        const written = new Set<string>();
        for (const commit of commits) {
            const targetNames = new Set(commit.files.map((file) => file.name));
            for (const file of commit.files) {
                const target = path.join(dir, file.name);
                await mkdir(path.dirname(target), { recursive: true });
                await writeFile(target, file.bytes);
            }
            for (const name of [...written]) {
                if (!targetNames.has(name)) {
                    await rm(path.join(dir, name), { force: true });
                }
            }
            written.clear();
            for (const name of targetNames) {
                written.add(name);
            }
            await git.add({ fs, dir, filepath: "." });
            await git.commit({
                fs,
                dir,
                message: commit.message,
                author: {
                    name: commit.authorName,
                    email: commit.authorEmail,
                    timestamp: Math.floor(commit.createdAt / 1000),
                },
            });
        }
        return dir;
    } catch (error) {
        await rm(dir, { recursive: true, force: true });
        throw error;
    }
}

/**
 * 把目录(含隐藏文件)打包为 zip。
 * @param dir - 待打包目录。
 * @returns zip 字节(ArrayBuffer)。
 */
export async function zipDirectory(dir: string): Promise<ArrayBuffer> {
    const entries: Zippable = {};
    async function walk(current: string): Promise<void> {
        const items = await readdir(current, { withFileTypes: true });
        for (const item of items) {
            const full = path.join(current, item.name);
            if (item.isDirectory()) {
                await walk(full);
            } else if (item.isFile()) {
                const relative = path
                    .relative(dir, full)
                    .split(path.sep)
                    .join("/");
                entries[relative] = await readFile(full);
            }
        }
    }
    await walk(dir);
    const data = zipSync(entries, { level: 6 });
    return data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength,
    ) as ArrayBuffer;
}
