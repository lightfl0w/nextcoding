import { getJson, HttpError, mutateJson, sendJson } from "./http";
import type { Snapshot, WorkVersion } from "./types";

/**
 * 版本管理的 git 对应关系：
 * - `git clone` / `git checkout` → `GET :id/versions/:version`（fetchSnapshot，返回整树）
 * - `git commit` → `PUT :id/versions`（commitWorkTree / commitWorkTreeByManifest）
 * - `git log` → `GET :id/versions`（fetchVersions）
 * - `git revert` → `POST :id/versions/:version/restore`（restoreVersion）
 * - `git commit --amend` → `PATCH :id/versions/:version`（renameVersionMessage）
 * 新客户端只需要这五个端点即可实现完整的版本工作流；
 * 增量同步（裸仓库对象库）见 `~/lib/api/repo`。
 */

export function workVersionsPath(workId: string): string {
    return `/api/works/${workId}/versions`;
}

/**
 * 某版本快照地址。
 * @param workId - 作品 ID。
 * @param version - 版本号。
 * @returns 同时作为 SWR key 使用。
 */
export function workSnapshotPath(workId: string, version: number): string {
    return `${workVersionsPath(workId)}/${version}`;
}

/**
 * 提交树中单个文件的内容。
 * 文本直接传字符串；二进制传 `{ b64, contentType? }`。
 */
export type CommitFilePayload = string | { b64: string; contentType?: string };

/**
 * manifest 模式中单个文件的引用。
 * 传哈希字符串，或 `{ hash, contentType? }`。
 */
export type ManifestFileRef = string | { hash: string; contentType?: string };

export type CommitTreeResult =
    | {
          outcome: "committed";
          version: number;
          message: string | null;
          fileCount: number;
          tree: string;
          hash: string;
      }
    | {
          outcome: "unchanged";
          version: number;
          tree: string;
      }
    | { outcome: "conflict"; currentVersion: number };

interface CommitOptions {
    message?: string | null;
    baseVersion?: number;
}

/**
 * 整树提交（git 式 commit，内联内容模式）。
 * @param workId - 作品 ID。
 * @param tree - 完整文件树：路径 → 内容（文本为字符串，二进制为 base64 对象）。
 * @param options.message - 版本说明。
 * @param options.baseVersion - 客户端基于的最新版本号（乐观锁）；
 * 服务器最新版本不一致时返回 `conflict` 与最新版本号，客户端应重新拉取后重试。
 */
export async function commitWorkTree(
    workId: string,
    tree: Record<string, CommitFilePayload>,
    options: CommitOptions = {},
): Promise<CommitTreeResult> {
    return commitPayload(workId, { files: tree }, options);
}

/**
 * 整树提交（git 式 commit，对象引用模式）。
 * 配合 `repo.ts` 的 fetchRepo/uploadObjects 做增量同步：
 * 先上传缺失对象，再以 `name → hash` 的 manifest 提交。
 * @param workId - 作品 ID。
 * @param manifest - 文件路径到对象哈希的引用。
 * @param options - 同 {@link commitWorkTree}。
 */
export async function commitWorkTreeByManifest(
    workId: string,
    manifest: Record<string, ManifestFileRef>,
    options: CommitOptions = {},
): Promise<CommitTreeResult> {
    return commitPayload(workId, { manifest }, options);
}

async function commitPayload(
    workId: string,
    body: {
        files?: Record<string, CommitFilePayload>;
        manifest?: Record<string, ManifestFileRef>;
    },
    options: CommitOptions,
): Promise<CommitTreeResult> {
    const response = await sendJson(workVersionsPath(workId), "PUT", {
        message: options.message ?? null,
        baseVersion: options.baseVersion,
        ...body,
    });

    if (response.status === 409) {
        const conflict = (await response.json()) as {
            currentVersion?: number;
        };
        return {
            outcome: "conflict",
            currentVersion: conflict.currentVersion ?? 0,
        };
    }
    if (!response.ok) {
        throw new HttpError(response.status, "提交失败");
    }

    const created = (await response.json()) as {
        version: number;
        message: string | null;
        fileCount: number;
        tree: string;
        hash: string;
        unchanged?: boolean;
    };
    if (created.unchanged === true) {
        return {
            outcome: "unchanged",
            version: created.version,
            tree: created.tree,
        };
    }
    return {
        outcome: "committed",
        version: created.version,
        message: created.message ?? null,
        fileCount: created.fileCount,
        tree: created.tree,
        hash: created.hash,
    };
}

export function fetchVersions(workId: string): Promise<WorkVersion[]> {
    return getJson<WorkVersion[]>(workVersionsPath(workId));
}

export function fetchSnapshot(
    workId: string,
    version: number,
): Promise<Snapshot> {
    return getJson<Snapshot>(workSnapshotPath(workId, version));
}

/**
 * 发布新版本。
 * @param workId - 作品 ID。
 * @param message - 版本说明；可为 `null`。
 * @returns 创建后的版本记录。
 */
export function publishVersion(
    workId: string,
    message: string | null,
): Promise<WorkVersion> {
    return mutateJson<WorkVersion>(workVersionsPath(workId), "POST", {
        message,
    });
}

/**
 * 回滚到指定版本。
 * @param workId - 作品 ID。
 * @param version - 目标版本号。
 * @returns 回滚结果与恢复的文件数量。
 */
export function restoreVersion(
    workId: string,
    version: number,
): Promise<{ ok: boolean; restoredVersion: number; files: number }> {
    return mutateJson(
        `${workVersionsPath(workId)}/${version}/restore`,
        "POST",
        undefined,
        "回滚失败",
    );
}

/**
 * 删除指定版本。
 * @param workId - 作品 ID。
 * @param version - 版本号。
 * @returns 删除结果。
 */
export function deleteVersion(
    workId: string,
    version: number,
): Promise<{ ok: boolean; deletedVersion: number }> {
    return mutateJson(
        `${workVersionsPath(workId)}/${version}`,
        "DELETE",
        undefined,
        "删除版本失败",
    );
}

/**
 * 修改版本说明。
 * @param workId - 作品 ID。
 * @param version - 版本号。
 * @param message - 新说明；可为 `null`。
 * @returns 更新结果。
 */
export function renameVersionMessage(
    workId: string,
    version: number,
    message: string | null,
): Promise<{ ok: boolean; version: number; message: string | null }> {
    return mutateJson(
        `${workVersionsPath(workId)}/${version}`,
        "PATCH",
        { message },
        "修改版本说明失败",
    );
}
