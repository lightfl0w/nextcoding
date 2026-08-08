import { del, put } from "@vercel/blob";
import type { StorageAdapter } from "./index";

export class VercelBlobStorage implements StorageAdapter {
    private token = process.env.BLOB_READ_WRITE_TOKEN!;

    async put(
        key: string,
        body: string | Uint8Array | Blob,
        opts?: { contentType?: string },
    ) {
        const data =
            body instanceof Blob
                ? body
                : new Blob([body as unknown as BlobPart]);
        const { url } = await put(key, data, {
            access: "public",
            contentType: opts?.contentType,
            token: this.token,
        });
        return { url };
    }
    async get(key: string) {
        const res = await fetch(key);
        return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
    }
    async delete(key: string) {
        await del(key, { token: this.token });
    }
    async getUrl(key: string) {
        return key;
    }
}
