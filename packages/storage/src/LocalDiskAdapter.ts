import type { Dirent } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { StorageAdapter } from "./index.js";

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

    async list(prefix: string) {
        const base = resolve(this.root);
        const dir = this.resolveSafe(prefix);
        const keys: string[] = [];
        const walk = async (current: string): Promise<void> => {
            let entries: Dirent[];
            try {
                entries = await readdir(current, { withFileTypes: true });
            } catch {
                return;
            }
            for (const entry of entries) {
                const full = join(current, entry.name);
                if (entry.isDirectory()) {
                    await walk(full);
                } else {
                    keys.push(relative(base, full).split(sep).join("/"));
                }
            }
        };
        await walk(dir);
        return keys;
    }
}
