import { afterEach, beforeEach, vi } from "vitest";
import type { AppNotification, WorkFile } from "../src/lib/api/types";

export function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}

export function makeFile(name: string): WorkFile {
    return {
        id: name,
        key: `works/w/${name}`,
        name,
        size: 1,
        contentType: null,
        version: 1,
        createdAt: "2026-01-01T00:00:00Z",
    };
}

export function makeNotification(
    overrides: Partial<AppNotification> = {},
): AppNotification {
    return {
        id: "n1",
        type: "spark",
        read: false,
        createdAt: new Date(2026, 7, 12, 9, 0, 0).toISOString(),
        actor: { id: "u2", name: "李四" },
        work: { id: "w1", title: "我的作品" },
        comment: null,
        ...overrides,
    };
}

export function setupFetchStub() {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn());
    });
    afterEach(() => {
        vi.useRealTimers();
    });
}
