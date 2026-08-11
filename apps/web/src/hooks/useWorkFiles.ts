import useSWR from "swr";
import type { WorkFile } from "~/lib/api";
import { fetchWorkFiles, workFilesPath } from "~/lib/api";

const NO_FILES: WorkFile[] = [];

/**
 * 作品的文件列表。
 * @param workId - 作品 ID。
 * @returns `reload` 为 SWR 重取。
 */
export function useWorkFiles(workId: string) {
    const { data, isLoading, mutate } = useSWR(
        workFilesPath(workId),
        fetchWorkFiles,
    );

    return { files: data?.files ?? NO_FILES, isLoading, reload: mutate };
}
