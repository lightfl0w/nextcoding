import { describe, expect, it } from "vitest";

import { openapiJson } from "../src/openapi/document.js";

interface OpenApiLike {
    openapi: string;
    info: { title: string };
    servers?: unknown[];
    paths?: Record<string, { put?: { responses: Record<string, unknown> } }>;
    components?: {
        schemas?: Record<string, unknown>;
        securitySchemes?: Record<string, unknown>;
    };
}

const doc = openapiJson as OpenApiLike;

describe("OpenAPI 文档", () => {
    it("生成有效文档且包含基础元信息", () => {
        expect(doc.openapi).toMatch(/^3\./);
        expect(doc.info.title).toBe("NextCoding API");
        expect(Array.isArray(doc.servers)).toBe(true);
        expect(JSON.parse(JSON.stringify(doc))).toBeTruthy();
    });

    it("覆盖作品模块全部端点", () => {
        const paths = Object.keys(doc.paths ?? {});
        for (const expected of [
            "/api/works",
            "/api/works/mine",
            "/api/works/{id}",
            "/api/works/{id}/publish",
            "/api/works/{id}/files",
            "/api/works/{id}/files/content",
            "/api/works/{id}/versions",
            "/api/works/{id}/versions/{version}",
            "/api/works/{id}/versions/{version}/restore",
            "/api/works/{id}/repo",
            "/api/works/{id}/commits/{hash}",
            "/api/works/{id}/objects/{hash}",
            "/api/works/{id}/objects/missing",
            "/api/works/import/git",
            "/api/works/import/git/jobs/{jobId}/events",
            "/api/works/{id}/export/git/push",
            "/api/works/{id}/comments",
            "/api/works/{id}/spark",
            "/api/works/{id}/remix",
            "/api/works/{id}/tree",
            "/api/works/{id}/bookmark",
            "/api/works/user/{userId}/bookmarks",
            "/api/works/{id}/report",
            "/api/works/leaderboard",
            "/api/notifications",
            "/api/notifications/unread-count",
        ]) {
            expect(paths, `缺少路径 ${expected}`).toContain(expected);
        }
    });

    it("整树提交的三种结果均声明了响应", () => {
        const put = doc.paths?.["/api/works/{id}/versions"]?.put;
        expect(Object.keys(put?.responses ?? {})).toEqual(
            expect.arrayContaining(["200", "201", "400", "409"]),
        );
    });

    it("注册了 git 同构所需的 schema 组件", () => {
        const schemas = doc.components?.schemas ?? {};
        for (const name of [
            "Snapshot",
            "RepoManifest",
            "RepoRef",
            "CommitTreeRequest",
            "CommittedResponse",
            "UnchangedResponse",
            "ConflictResponse",
            "WorkDetail",
            "WorkVersion",
            "Comment",
            "Notification",
        ]) {
            expect(schemas[name], `缺少 schema ${name}`).toBeDefined();
        }
        expect(doc.components?.securitySchemes?.sessionCookie).toMatchObject({
            type: "apiKey",
            in: "cookie",
            name: "session",
        });
    });
});
