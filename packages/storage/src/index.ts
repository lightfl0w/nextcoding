import { LocalDiskStorage } from "./LocalDiskAdapter.js";
import { S3Adapter } from "./S3Adapter.js";
import { VercelBlobStorage } from "./VercelBlobAdapter.js";

export interface StorageAdapter {
    put(
        key: string,
        body: string | Uint8Array | Blob,
        opts?: { contentType?: string },
    ): Promise<void>;
    get(key: string): Promise<Uint8Array | null>;
    delete(key: string): Promise<void>;
    /**
     * 列出指定前缀下的全部对象 key。
     * @param prefix - key 前缀，如 "avatars/user-1/"。
     */
    list(prefix: string): Promise<string[]>;
}

export function createStorage(): StorageAdapter {
    switch (process.env.STORAGE_DRIVER) {
        case "s3":
            return new S3Adapter();
        case "vercel-blob":
            return new VercelBlobStorage();
        default:
            return new LocalDiskStorage();
    }
}

export { LocalDiskStorage } from "./LocalDiskAdapter.js";
export { S3Adapter } from "./S3Adapter.js";
export { VercelBlobStorage } from "./VercelBlobAdapter.js";
