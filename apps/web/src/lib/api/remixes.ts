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

/**
 * 基于作品创建二创副本。
 * @param workId - 原作品 ID。
 * @returns 新作品信息。
 */
export function remixWork(workId: string): Promise<RemixResult> {
    return mutateJson(workRemixPath(workId), "POST", undefined, "二创失败");
}

export function fetchWorkSource(workId: string): Promise<WorkSource | null> {
    return getJson<WorkSource | null>(workSourcePath(workId));
}

export function fetchWorkRemixes(workId: string): Promise<Work[]> {
    return getJson<Work[]>(workRemixesPath(workId));
}
