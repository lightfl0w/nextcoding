import { LocalDiskStorage } from "./LocalDiskAdapter.js";
import { S3Adapter } from "./S3Adapter.js";
import { VercelBlobStorage } from "./VercelBlobAdapter.js";

export interface StorageAdapter {
    put(
        key: string,
        body: string | Uint8Array | Blob,
        opts?: { contentType?: string },
    ): Promise<{ url: string }>;
    get(key: string): Promise<Uint8Array | null>;
    delete(key: string): Promise<void>;
    getUrl(key: string): Promise<string>;
}

// 按 STORAGE_DRIVER 选择存储后端：local（默认）| s3 | vercel-blob
export function createStorage(): StorageAdapter {
    switch (process.env.STORAGE_DRIVER) {
        case "s3":
            return new S3Adapter(process.env.S3_BUCKET!);
        case "vercel-blob":
            return new VercelBlobStorage();
        case "local":
        default:
            return new LocalDiskStorage();
    }
}

export { LocalDiskStorage } from "./LocalDiskAdapter.js";
export { S3Adapter } from "./S3Adapter.js";
export { VercelBlobStorage } from "./VercelBlobAdapter.js";
