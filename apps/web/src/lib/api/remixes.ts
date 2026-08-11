import { getJson, mutateJson } from "./http";
import type { RemixResult, Work, WorkSource } from "./types";

export function workRemixPath(workId: string): string {
    return `/api/works/${workId}/remix`;
}

export function workSourcePath(workId: string): string {
    return `/api/works/${workId}/source`;
}

export function workRemixesPath(workId: string): string {
    return `/api/works/${workId}/remixes`;
}

export function remixWork(workId: string): Promise<RemixResult> {
    return mutateJson(workRemixPath(workId), "POST", undefined, "二创失败");
}

export function fetchWorkSource(workId: string): Promise<WorkSource | null> {
    return getJson<WorkSource | null>(workSourcePath(workId));
}

export function fetchWorkRemixes(workId: string): Promise<Work[]> {
    return getJson<Work[]>(workRemixesPath(workId));
}
