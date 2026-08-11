import { getJson, mutateJson } from "./http";
import type { Snapshot, WorkVersion } from "./types";

export function workVersionsPath(workId: string): string {
    return `/api/works/${workId}/versions`;
}

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

export function publishVersion(
    workId: string,
    message: string | null,
): Promise<WorkVersion> {
    return mutateJson<WorkVersion>(workVersionsPath(workId), "POST", {
        message,
    });
}

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
