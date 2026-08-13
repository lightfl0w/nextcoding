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
 * @param workId - 作品 ID；`null`（待创建模式）时返回空版本且不可发布。
 * @returns 版本列表与保存草稿/回滚动作。
 * @remarks 保存草稿成功后本地追加记录。
 */
export function useVersionHistory(workId: string | null) {
    const { data: versions = NO_VERSIONS, mutate } = useSWR(
        workId === null ? null : workVersionsPath(workId),
        () => fetchVersions(workId as string),
    );

    const publish = useCallback(
        async (message: string | null): Promise<boolean> => {
            if (workId === null) {
                return false;
            }
            try {
                const created = await publishVersion(workId, message);
                mutate((current = []) => [created, ...current], false);
                toast.success(`已保存草稿 v${created.version}`);
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
            if (workId === null) {
                return;
            }
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
