import { getJson, mutateJson } from "./http";

export function workSparkPath(workId: string): string {
    return `/api/works/${workId}/spark`;
}

export function fetchWorkSpark(workId: string): Promise<{ sparked: boolean }> {
    return getJson<{ sparked: boolean }>(workSparkPath(workId));
}

export function giveSpark(workId: string): Promise<{ sparked: boolean }> {
    return mutateJson(workSparkPath(workId), "POST", undefined, "送火花失败");
}
