import type { StorageAdapter } from "@nextcoding/storage";

export interface MemoryStorage extends StorageAdapter {
    store: Map<string, Uint8Array>;
    putCalls: Array<{ key: string; contentType?: string }>;
}

/**
 * 内存版存储适配器，供路由测试替代真实磁盘/S3。
 * 同时记录 put 调用的 contentType，便于断言。
 */
export function createMemoryStorage(): MemoryStorage {
    const store = new Map<string, Uint8Array>();
    const putCalls: Array<{ key: string; contentType?: string }> = [];

    async function toBytes(
        body: string | Uint8Array | Blob,
    ): Promise<Uint8Array> {
        if (typeof body === "string") {
            return new TextEncoder().encode(body);
        }
        if (body instanceof Blob) {
            return new Uint8Array(await body.arrayBuffer());
        }
        return body;
    }

    return {
        store,
        putCalls,
        async put(key, body, opts) {
            putCalls.push({ key, contentType: opts?.contentType });
            store.set(key, await toBytes(body));
        },
        async get(key) {
            return store.get(key) ?? null;
        },
        async delete(key) {
            store.delete(key);
        },
    };
}

/**
 * 造一条作品摘要行，供序列化与列表路由测试使用。
 */
export function makeWorkSummaryRow(overrides: Record<string, unknown> = {}) {
    return {
        id: "work-1",
        title: "我的作品",
        description: "简介",
        coverUrl: null,
        tags: JSON.stringify(["js", "demo"]),
        views: 10,
        likes: 2,
        sparks: 3,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        authorId: "user-1",
        authorName: "张三",
        authorImage: null,
        authorBio: null,
        ...overrides,
    };
}

/**
 * 造一条作品文件行，供文件/快照路由测试使用。
 */
export function makeWorkFileRow(overrides: Record<string, unknown> = {}) {
    return {
        id: "file-1",
        workId: "work-1",
        key: "works/work-1/main.js",
        name: "main.js",
        size: 5,
        contentType: "text/javascript",
        version: 1,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        ...overrides,
    };
}

/**
 * 造一个已登录 session；传 `null` 表示未登录。
 */
export function makeSession(
    user: { id: string; name?: string } | null = { id: "user-1", name: "张三" },
) {
    if (!user) {
        return null;
    }
    return {
        user: { id: user.id, name: user.name ?? null },
        session: { id: "sess-1" },
    };
}
