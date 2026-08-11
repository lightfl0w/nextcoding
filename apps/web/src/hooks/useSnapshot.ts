import useSWR from "swr";
import { fetchSnapshot, workSnapshotPath } from "~/lib/api";

export function useSnapshot(workId: string, version: number | null) {
    return useSWR(
        version === null ? null : workSnapshotPath(workId, version),
        () => fetchSnapshot(workId, version as number),
    );
}
