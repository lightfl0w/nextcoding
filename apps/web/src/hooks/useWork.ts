import useSWR from "swr";
import type { WorkDetail } from "~/lib/api";
import { fetchWork, workPath } from "~/lib/api";

export function useWork(id: string) {
    return useSWR<WorkDetail>(workPath(id), fetchWork);
}
