import { useCallback } from "react";
import useSWR from "swr";
import type { WorkFile } from "~/lib/api";
import { fetchWorkFiles, workFilesPath } from "~/lib/api";

const NO_FILES: WorkFile[] = [];

/**
 * 作品的文件列表。
 * @param workId - 作品 ID；`null`（待创建模式）时返回空列表。
 * @returns `reload` 为 SWR 重取；待创建模式退化为空操作。
 */
export function useWorkFiles(workId: string | null) {
    const { data, isLoading, mutate } = useSWR(
        workId === null ? null : workFilesPath(workId),
        fetchWorkFiles,
    );

    const reload = useCallback(async () => {
        if (workId !== null) {
            await mutate();
        }
    }, [workId, mutate]);

    return { files: data?.files ?? NO_FILES, isLoading, reload };
}
