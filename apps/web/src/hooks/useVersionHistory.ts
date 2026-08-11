import { toast } from "@heroui/react";
import { useCallback } from "react";
import useSWR from "swr";
import type { WorkVersion } from "~/lib/api";
import {
    fetchVersions,
    publishVersion,
    restoreVersion,
    workVersionsPath,
} from "~/lib/api";

const NO_VERSIONS: WorkVersion[] = [];

/**
 * 版本历史。
 * @param workId - 作品 ID。
 * @returns 版本列表与发布/回滚动作。
 * @remarks 发布成功后本地追加记录。
 */
export function useVersionHistory(workId: string) {
    const { data: versions = NO_VERSIONS, mutate } = useSWR(
        workVersionsPath(workId),
        () => fetchVersions(workId),
    );

    const publish = useCallback(
        async (message: string | null): Promise<boolean> => {
            try {
                const created = await publishVersion(workId, message);
                mutate((current = []) => [created, ...current], false);
                toast.success(`已发布 v${created.version}`);
                return true;
            } catch (error) {
                toast.danger((error as Error).message);
                return false;
            }
        },
        [workId, mutate],
    );

    const restore = useCallback(
        async (version: number) => {
            try {
                await restoreVersion(workId, version);
                window.location.reload();
            } catch (error) {
                toast.danger((error as Error).message);
            }
        },
        [workId],
    );

    return { versions, publish, restore };
}
