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
