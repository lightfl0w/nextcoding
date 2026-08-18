import { getJson, HttpError, sendJson } from "./http";
import type { Snapshot } from "./types";

/**
 * 裸仓库协议（不基于 git）：
 * 每个作品暴露为「对象库 + refs」形式的裸仓库。
 * - `GET  :id/repo`            仓库清单：head/refs（提交哈希链）+ 服务端持有的全部对象哈希
 * - `GET  :id/commits/:hash`   按提交哈希取提交对象
 * - `GET  :id/objects/:hash`   按内容哈希取对象（增量拉取）
 * - `POST :id/objects`         批量上传缺失对象（增量推送）
 *
 * 增量同步工作流：
 * 1. fetchRepo() 得到服务端 `objects`（已有集合）与 `head`（最新提交）
 * 2. 本地计算新树的 blob 哈希，`missing = 本地哈希 − objects`
 * 3. uploadObjects(workId, missing) 只传缺失对象
 * 4. commitWorkTreeByManifest(workId, { name: hash }) 以对象引用提交
 */

export interface RepoRef {
    version: number;
    message: string | null;
    createdAt: string;
    tree: string;
    hash: string;
    parent: string | null;
    author: { id: string; name: string | null } | null;
}

export interface RepoManifest {
    head: RepoRef | null;
    refs: RepoRef[];
    objects: string[];
}

export function repoPath(workId: string): string {
    return `/api/works/${workId}/repo`;
}

export function commitPath(workId: string, hash: string): string {
    return `/api/works/${workId}/commits/${hash}`;
}

export function workObjectPath(workId: string, hash: string): string {
    return `/api/works/${workId}/objects/${hash}`;
}

/**
 * 拉取裸仓库清单（refs 提交哈希链 + 服务端对象哈希集合）。
 * @param workId - 作品 ID。
 */
export function fetchRepo(workId: string): Promise<RepoManifest> {
    return getJson<RepoManifest>(repoPath(workId));
}

/**
 * 按提交哈希取提交对象（快照；文件内容需再按版本或对象拉取）。
 * @param workId - 作品 ID。
 * @param hash - 提交哈希。
 */
export function fetchCommit(workId: string, hash: string): Promise<Snapshot> {
    return getJson<Snapshot>(commitPath(workId, hash));
}

/**
 * 按内容哈希拉取对象原始字节。
 * @param workId - 作品 ID。
 * @param hash - 对象 SHA-256。
 */
export async function fetchObject(
    workId: string,
    hash: string,
): Promise<Uint8Array> {
    const response = await fetch(workObjectPath(workId, hash));
    if (!response.ok) {
        throw new HttpError(response.status, "对象拉取失败");
    }
    return new Uint8Array(await response.arrayBuffer());
}

/**
 * 批量上传缺失对象（`hash → base64`）。
 * @param workId - 作品 ID。
 * @param objects - 对象哈希到 base64 内容的映射。
 * @returns 实际新增的对象数。
 */
export async function uploadObjects(
    workId: string,
    objects: Record<string, string>,
): Promise<{ ok: boolean; uploaded: number }> {
    const response = await sendJson(`/api/works/${workId}/objects`, "POST", {
        objects,
    });
    if (!response.ok) {
        let message: string | undefined;
        try {
            const body = (await response.json()) as { error?: string };
            if (typeof body.error === "string") {
                message = body.error;
            }
        } catch {}
        throw new HttpError(response.status, message ?? "对象上传失败");
    }
    return response.json() as Promise<{ ok: boolean; uploaded: number }>;
}

/**
 * 反向 have/want：带上本地已有的哈希集合，服务端只回缺失的对象。
 * 大仓库无需下载全部 `objects` 集合。
 * @param workId - 作品 ID。
 * @param has - 客户端本地持有的对象哈希集合。
 * @returns 服务端缺失的对象哈希。
 */
export async function missingObjects(
    workId: string,
    has: string[],
): Promise<{ missing: string[] }> {
    const response = await sendJson(
        `/api/works/${workId}/objects/missing`,
        "POST",
        { has },
    );
    if (!response.ok) {
        throw new HttpError(response.status, "对象协商失败");
    }
    return response.json() as Promise<{ missing: string[] }>;
}

/**
 * 直传原始字节上传单个对象（免 base64 膨胀）。
 * @param workId - 作品 ID。
 * @param hash - 对象 SHA-256（须与内容一致）。
 * @param bytes - 原始字节。
 * @returns 是否为新写入（已存在时为 false）。
 */
export async function uploadObjectRaw(
    workId: string,
    hash: string,
    bytes: Uint8Array,
): Promise<{ ok: boolean; uploaded: boolean }> {
    const buffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const response = await fetch(workObjectPath(workId, hash), {
        method: "PUT",
        body: buffer,
    });
    if (!response.ok) {
        let message: string | undefined;
        try {
            const body = (await response.json()) as { error?: string };
            if (typeof body.error === "string") {
                message = body.error;
            }
        } catch {}
        throw new HttpError(response.status, message ?? "对象上传失败");
    }
    return response.json() as Promise<{ ok: boolean; uploaded: boolean }>;
}
