import { toast } from "@heroui/react";
import { useCallback } from "react";
import useSWR from "swr";
import type { WorkVersion } from "~/lib/api";
import {
    deleteVersion,
    fetchVersions,
    publishVersion,
    renameVersionMessage,
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

    const remove = useCallback(
        async (version: number): Promise<boolean> => {
            if (workId === null) {
                return false;
            }
            try {
                await deleteVersion(workId, version);
                mutate(
                    (current = []) =>
                        current.filter((row) => row.version !== version),
                    false,
                );
                toast.success(`已删除 v${version}`);
                return true;
            } catch (error) {
                toast.danger((error as Error).message);
                return false;
            }
        },
        [workId, mutate],
    );

    const rename = useCallback(
        async (version: number, message: string | null): Promise<boolean> => {
            if (workId === null) {
                return false;
            }
            try {
                const updated = await renameVersionMessage(
                    workId,
                    version,
                    message,
                );
                mutate(
                    (current = []) =>
                        current.map((row) =>
                            row.version === version
                                ? { ...row, message: updated.message }
                                : row,
                        ),
                    false,
                );
                toast.success(`已更新 v${version} 的说明`);
                return true;
            } catch (error) {
                toast.danger((error as Error).message);
                return false;
            }
        },
        [workId, mutate],
    );

    return { versions, publish, restore, remove, rename };
}
