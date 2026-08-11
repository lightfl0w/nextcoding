import useSWR from "swr";
import type { WorkDetail } from "~/lib/api";
import { fetchWork, workPath } from "~/lib/api";

/**
 * 单个作品详情。
 * @param id - 作品 ID。
 */
export function useWork(id: string) {
    return useSWR<WorkDetail>(workPath(id), fetchWork);
}
