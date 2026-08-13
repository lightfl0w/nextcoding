import useSWR from "swr";
import { fetchSnapshot, workSnapshotPath } from "~/lib/api";

/**
 * 某版本文件快照。
 * @param workId - 作品 ID；`null`（待创建模式）时不请求。
 * @param version - 版本号；为 `null` 时不请求。
 */
export function useSnapshot(workId: string | null, version: number | null) {
    return useSWR(
        workId === null || version === null
            ? null
            : workSnapshotPath(workId, version),
        () => fetchSnapshot(workId as string, version as number),
    );
}
