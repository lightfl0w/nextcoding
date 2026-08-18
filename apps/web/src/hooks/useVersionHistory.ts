import { toast } from "@heroui/react";
import { useCallback, useRef } from "react";
import useSWR from "swr";
import type { WorkVersion } from "~/lib/api";
import {
    type CommitFilePayload,
    commitWorkTree,
    deleteVersion,
    fetchVersions,
    renameVersionMessage,
    restoreVersion,
    workVersionsPath,
} from "~/lib/api";

const NO_VERSIONS: WorkVersion[] = [];

export type PublishOutcome = { version: number } | { conflict: number } | null;

/**
 * 版本历史。
 * @param workId - 作品 ID；`null`（待创建模式）时返回空版本且不可发布。
 * @returns 版本列表与保存草稿/回滚动作。
 * @remarks 保存草稿通过整树提交完成，携带客户端基于的最新版本号做乐观锁；
 * 版本落后时返回 conflict，调用方应刷新本地文件树后重试。
 */
export function useVersionHistory(workId: string | null) {
    const { data: versions = NO_VERSIONS, mutate } = useSWR(
        workId === null ? null : workVersionsPath(workId),
        () => fetchVersions(workId as string),
    );

    const latestVersionRef = useRef<number | undefined>(undefined);
    latestVersionRef.current = versions[0]?.version;

    const publish = useCallback(
        async (
            message: string | null,
            tree: Record<string, CommitFilePayload> = {},
        ): Promise<PublishOutcome> => {
            if (workId === null) {
                return null;
            }
            try {
                const committed = await commitWorkTree(workId, tree, {
                    message,
                    baseVersion: latestVersionRef.current,
                });
                if (committed.outcome === "conflict") {
                    toast.warning(
                        `作品已被更新到 v${committed.currentVersion}，已同步最新状态`,
                    );
                    return { conflict: committed.currentVersion };
                }
                if (committed.outcome === "unchanged") {
                    toast.success("没有变更，未产生新版本");
                    return { version: committed.version };
                }
                const created: WorkVersion = {
                    version: committed.version,
                    message: committed.message,
                    createdAt: new Date().toISOString(),
                    author: null,
                };
                mutate((current = []) => [created, ...current], false);
                toast.success(`已保存草稿 v${committed.version}`);
                return { version: committed.version };
            } catch (error) {
                toast.danger((error as Error).message);
                return null;
            }
        },
        [workId, mutate],
    );

    const refresh = useCallback(() => mutate(), [mutate]);

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

    return {
        versions,
        publish,
        refresh,
        restore,
        remove,
        rename,
    };
}
