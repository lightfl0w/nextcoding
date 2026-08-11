import useSWR from "swr";
import { fileContentPath, readFileContent } from "~/lib/api";

/**
 * 单个文件内容。
 * @param workId - 作品 ID。
 * @param key - 文件 key；为 `null` 时不请求。
 */
export function useFileContent(workId: string, key: string | null) {
    return useSWR(key === null ? null : fileContentPath(workId, key), () =>
        readFileContent(workId, key as string),
    );
}
