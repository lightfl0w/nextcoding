import {
    getJson,
    getTextOrEmpty,
    HttpError,
    mutateJson,
    sendJson,
} from "./http";
import type { WorkFile } from "./types";

export function workFilesPath(workId: string): string {
    return `/api/works/${workId}/files`;
}

export function fileContentPath(workId: string, key: string): string {
    return `${workFilesPath(workId)}/content?key=${encodeURIComponent(key)}`;
}

export function fetchWorkFiles(path: string): Promise<{ files: WorkFile[] }> {
    return getJson<{ files: WorkFile[] }>(path);
}

export function readFileContent(workId: string, key: string): Promise<string> {
    return getTextOrEmpty(fileContentPath(workId, key));
}

export type CreatedFile =
    | { outcome: "created"; key: string; version: number }
    | { outcome: "duplicate" }
    | { outcome: "rejected" };

export async function createWorkFile(
    workId: string,
    name: string,
): Promise<CreatedFile> {
    const response = await sendJson(workFilesPath(workId), "POST", {
        name,
        content: "",
    });
    if (response.status === 409) return { outcome: "duplicate" };
    if (!response.ok) return { outcome: "rejected" };

    const file = (await response.json()) as { key: string; version?: number };
    return { outcome: "created", key: file.key, version: file.version ?? 1 };
}

export type SavedFile =
    | { outcome: "saved"; version: number }
    | { outcome: "conflict"; currentVersion: number };

export async function saveFileContent(
    workId: string,
    key: string,
    content: string,
    expectedVersion: number,
): Promise<SavedFile> {
    const response = await sendJson(`${workFilesPath(workId)}/content`, "PUT", {
        key,
        content,
        expectedVersion,
    });

    if (response.status === 409) {
        const conflict = (await response.json()) as {
            currentVersion?: number;
        };
        return {
            outcome: "conflict",
            currentVersion: conflict.currentVersion ?? 1,
        };
    }
    if (!response.ok) throw new HttpError(response.status, "保存失败");

    const saved = (await response.json()) as { version: number };
    return { outcome: "saved", version: saved.version };
}

export function deleteWorkFile(workId: string, key: string): Promise<unknown> {
    const path = `${workFilesPath(workId)}?key=${encodeURIComponent(key)}`;
    return mutateJson(path, "DELETE", undefined, "删除失败");
}
