import { getJson, mutateJson } from "./http";
import type { Snapshot, WorkVersion } from "./types";

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
