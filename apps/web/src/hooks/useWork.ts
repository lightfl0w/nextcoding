import useSWR from "swr";
import type { WorkDetail } from "~/lib/api";
import { fetchWork, workPath } from "~/lib/api";

/**
 * 单个作品详情。
 * @param id - 作品 ID；`null`（待创建模式）时不请求。
 */
export function useWork(id: string | null) {
    return useSWR<WorkDetail>(id === null ? null : workPath(id), fetchWork);
}
