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

/**
 * 文件内容地址。
 * @param workId - 作品 ID。
 * @param key - 文件 key。
 * @returns 同时作为 SWR key 使用。
 */
export function fileContentPath(workId: string, key: string): string {
    return `${workFilesPath(workId)}/content?key=${encodeURIComponent(key)}`;
}

/**
 * 获取文件列表。
 * @param path - 由调用方传入的 SWR key，与缓存保持一致。
 * @returns 文件列表。
 */
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

/**
 * 新建空文件。
 * @param workId - 作品 ID。
 * @param name - 文件名。
 * @returns `created` 携带新文件信息；同名返回 `duplicate`，其余失败返回 `rejected`。
 */
export async function createWorkFile(
    workId: string,
    name: string,
): Promise<CreatedFile> {
    const response = await sendJson(workFilesPath(workId), "POST", {
        name,
        content: "",
    });
    if (response.status === 409) {
        return { outcome: "duplicate" };
    }
    if (!response.ok) {
        return { outcome: "rejected" };
    }

    const file = (await response.json()) as { key: string; version?: number };
    return { outcome: "created", key: file.key, version: file.version ?? 1 };
}

export type SavedFile =
    | { outcome: "saved"; version: number }
    | { outcome: "conflict"; currentVersion: number };

/**
 * 携带乐观版本号保存内容。
 * @param workId - 作品 ID。
 * @param key - 文件 key。
 * @param content - 新内容。
 * @param expectedVersion - 预期的当前版本号。
 * @returns `saved` 携带最新版本；版本不符时返回 `conflict` 与当前版本。
 */
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
    if (!response.ok) {
        throw new HttpError(response.status, "保存失败");
    }

    const saved = (await response.json()) as { version: number };
    return { outcome: "saved", version: saved.version };
}

export function deleteWorkFile(workId: string, key: string): Promise<unknown> {
    const path = `${workFilesPath(workId)}?key=${encodeURIComponent(key)}`;
    return mutateJson(path, "DELETE", undefined, "删除失败");
}

export type RenamedFile =
    | { outcome: "renamed"; key: string; version: number }
    | { outcome: "duplicate" }
    | { outcome: "missing" }
    | { outcome: "rejected" };

/**
 * 重命名文件。
 * @param workId - 作品 ID。
 * @param key - 原文件 key。
 * @param newName - 新文件名（可为含目录的相对路径）。
 * @returns `renamed` 携带新 key 与版本号；同名冲突返回 `duplicate`，文件已消失返回 `missing`，其余失败返回 `rejected`。
 */
export async function renameWorkFile(
    workId: string,
    key: string,
    newName: string,
): Promise<RenamedFile> {
    const response = await sendJson(workFilesPath(workId), "PATCH", {
        key,
        newName,
    });
    if (response.status === 409) {
        return { outcome: "duplicate" };
    }
    if (response.status === 404) {
        return { outcome: "missing" };
    }
    if (!response.ok) {
        return { outcome: "rejected" };
    }

    const file = (await response.json()) as { key: string; version?: number };
    return { outcome: "renamed", key: file.key, version: file.version ?? 1 };
}

export function deleteFolder(workId: string, folder: string): Promise<unknown> {
    const path = `${workFilesPath(workId)}/folder?name=${encodeURIComponent(folder)}`;
    return mutateJson(path, "DELETE", undefined, "删除失败");
}
