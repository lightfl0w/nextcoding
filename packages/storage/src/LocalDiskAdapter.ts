import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type { StorageAdapter } from "./index";

export class LocalDiskStorage implements StorageAdapter {
    constructor(
        private root: string = process.env.STORAGE_LOCAL_DIR ?? "data",
    ) {}

    private resolveSafe(key: string) {
        const base = resolve(this.root);
        const abs = resolve(base, key);
        if (abs !== base && !abs.startsWith(base + sep)) {
            throw new Error(`Error path: ${key}`);
        }
        return abs;
    }

    async put(key: string, body: string | Uint8Array | Blob) {
        const file = this.resolveSafe(key);
        await mkdir(dirname(file), { recursive: true });
        const data =
            body instanceof Blob
                ? new Uint8Array(await body.arrayBuffer())
                : body;
        await writeFile(file, data);
        return { url: await this.getUrl(key) };
    }

    async get(key: string) {
        try {
            return new Uint8Array(await readFile(this.resolveSafe(key)));
        } catch {
            return null;
        }
    }

    async delete(key: string) {
        await rm(this.resolveSafe(key), { force: true });
    }

    async getUrl(key: string) {
        return `/storage/${key}`;
    }
}
