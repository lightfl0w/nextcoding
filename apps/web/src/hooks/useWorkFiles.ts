import useSWR from "swr";
import type { WorkFile } from "~/lib/api";
import { fetchWorkFiles, workFilesPath } from "~/lib/api";

const NO_FILES: WorkFile[] = [];

export function useWorkFiles(workId: string) {
    const { data, isLoading, mutate } = useSWR(
        workFilesPath(workId),
        fetchWorkFiles,
    );

    return { files: data?.files ?? NO_FILES, isLoading, reload: mutate };
}
