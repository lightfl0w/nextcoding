import useSWR from "swr";
import type { Work } from "~/lib/api";
import {
    fetchWorkRemixes,
    fetchWorkSource,
    workRemixesPath,
    workSourcePath,
} from "~/lib/api";

const NO_REMIXES: Work[] = [];

/**
 * 作品的二创列表。
 * @param workId - 作品 ID。
 */
export function useWorkRemixes(workId: string) {
    const { data } = useSWR(workRemixesPath(workId), () =>
        fetchWorkRemixes(workId),
    );
    return data ?? NO_REMIXES;
}

/**
 * 作品的源头。
 * @param workId - 作品 ID。
 * @returns 被谁二创而来；独立作品为 `null`。
 */
export function useWorkSource(workId: string) {
    const { data } = useSWR(workSourcePath(workId), () =>
        fetchWorkSource(workId),
    );
    return data ?? null;
}
