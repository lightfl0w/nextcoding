import useSWR from "swr";
import type { Work } from "~/lib/api";
import {
    fetchWorkRemixes,
    fetchWorkSource,
    workRemixesPath,
    workSourcePath,
} from "~/lib/api";

const NO_REMIXES: Work[] = [];

export function useWorkRemixes(workId: string) {
    const { data } = useSWR(workRemixesPath(workId), () =>
        fetchWorkRemixes(workId),
    );
    return data ?? NO_REMIXES;
}

export function useWorkSource(workId: string) {
    const { data } = useSWR(workSourcePath(workId), () =>
        fetchWorkSource(workId),
    );
    return data ?? null;
}
