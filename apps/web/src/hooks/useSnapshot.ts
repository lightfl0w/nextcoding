import useSWR from "swr";
import { fetchSnapshot, workSnapshotPath } from "~/lib/api";

/**
 * 某版本文件快照。
 * @param workId - 作品 ID。
 * @param version - 版本号；为 `null` 时不请求。
 */
export function useSnapshot(workId: string, version: number | null) {
    return useSWR(
        version === null ? null : workSnapshotPath(workId, version),
        () => fetchSnapshot(workId, version as number),
    );
}
