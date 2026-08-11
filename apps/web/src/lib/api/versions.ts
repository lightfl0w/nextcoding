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
