import { createStorage, type StorageAdapter } from "@nextcoding/storage";

let sharedAdapter: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
    sharedAdapter ??= createStorage();
    return sharedAdapter;
}
