import useSWR from "swr";
import type { Work, WorkSort } from "~/lib/api";
import { fetchWorks, worksPath } from "~/lib/api";

const DEFAULT_LIMIT = 20;

export function useWorks(sort: WorkSort = "latest", limit = DEFAULT_LIMIT) {
    return useSWR<Work[]>(worksPath(sort, limit), fetchWorks, {
        keepPreviousData: true,
    });
}
