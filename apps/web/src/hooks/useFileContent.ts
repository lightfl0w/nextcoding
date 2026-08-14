import useSWR from "swr";
import { fileContentPath, readFileContent } from "~/lib/api";

/**
 * 单个文件内容。
 * @param workId - 作品 ID；`null`（待创建模式）时不请求。
 * @param key - 文件 key；为 `null` 时不请求。
 */
export function useFileContent(workId: string | null, key: string | null) {
    return useSWR(
        workId === null || key === null ? null : fileContentPath(workId, key),
        () => readFileContent(workId as string, key as string),
    );
}
