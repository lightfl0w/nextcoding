import useSWR from "swr";
import { fileContentPath, readFileContent } from "~/lib/api";

export function useFileContent(workId: string, key: string | null) {
    return useSWR(key === null ? null : fileContentPath(workId, key), () =>
        readFileContent(workId, key as string),
    );
}
