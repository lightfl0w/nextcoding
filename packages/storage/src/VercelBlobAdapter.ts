import { del, put } from "@vercel/blob";
import type { StorageAdapter } from "./index.js";

export class VercelBlobStorage implements StorageAdapter {
    private token: string;

    constructor() {
        const token = process.env.BLOB_READ_WRITE_TOKEN;
        if (!token) throw new Error("缺少环境变量 BLOB_READ_WRITE_TOKEN");
        this.token = token;
    }

    async put(
        key: string,
        body: string | Uint8Array | Blob,
        opts?: { contentType?: string },
    ) {
        const data =
            body instanceof Blob
                ? body
                : new Blob([body as unknown as BlobPart]);
        await put(key, data, {
            access: "public",
            contentType: opts?.contentType,
            token: this.token,
        });
    }
    async get(key: string) {
        const res = await fetch(key);
        return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
    }
    async delete(key: string) {
        await del(key, { token: this.token });
    }
}
