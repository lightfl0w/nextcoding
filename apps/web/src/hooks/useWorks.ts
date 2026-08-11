import useSWR from "swr";
import type { Work, WorkSort } from "~/lib/api";
import { fetchWorks, worksPath } from "~/lib/api";

const DEFAULT_LIMIT = 20;

/**
 * 发现页作品列表。
 * @param sort - 排序方式。
 * @param limit - 每页条数。
 * @remarks SWR key 随排序与 limit 变化。
 */
export function useWorks(sort: WorkSort = "latest", limit = DEFAULT_LIMIT) {
    return useSWR<Work[]>(worksPath(sort, limit), fetchWorks, {
        keepPreviousData: true,
    });
}
