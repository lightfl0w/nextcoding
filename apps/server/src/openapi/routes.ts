import { createRoute, type RouteConfig, z } from "@hono/zod-openapi";

import {
    catalogItemSchema,
    commentSchema,
    commitTreeSchema,
    committedResponseSchema,
    conflictResponseSchema,
    contributorLeaderboardItemSchema,
    errorSchema,
    notificationSchema,
    ownedWorkSchema,
    remixTreeSchema,
    repoManifestSchema,
    sha256,
    snapshotSchema,
    unchangedResponseSchema,
    workDetailSchema,
    workFileSchema,
    workLeaderboardItemSchema,
    workSourceSchema,
    workSummarySchema,
    workVersionSchema,
} from "./schemas.js";

export const secure = [{ sessionCookie: [] as string[] }];

export const sessionCookieSecurityScheme = {
    type: "apiKey",
    in: "cookie",
    name: "session",
    description: "登录后由 better-auth 设置的会话 Cookie",
} as const;

const errors = {
    400: {
        description: "参数不合法",
        content: { "application/json": { schema: errorSchema } },
    },
    401: {
        description: "未登录",
        content: { "application/json": { schema: errorSchema } },
    },
    403: {
        description: "无权限",
        content: { "application/json": { schema: errorSchema } },
    },
    404: {
        description: "资源不存在",
        content: { "application/json": { schema: errorSchema } },
    },
    409: {
        description: "状态冲突",
        content: { "application/json": { schema: errorSchema } },
    },
    500: {
        description: "服务器内部错误",
        content: { "application/json": { schema: errorSchema } },
    },
} as const;

const json = (schema: z.ZodType) => ({ "application/json": { schema } });

export const routes: RouteConfig[] = [
    createRoute({
        method: "get",
        path: "/api/works",
        tags: ["作品"],
        summary: "作品列表",
        description: "首页作品流，支持排序、搜索与分页。",
        request: {
            query: z.object({
                sort: z
                    .enum(["newest", "popular"])
                    .optional()
                    .describe("排序方式"),
                limit: z.number().int().min(1).max(50).optional(),
                q: z.string().max(64).optional().describe("搜索关键词"),
            }),
        },
        responses: {
            200: {
                description: "作品列表（未登录时 sparked 恒为 false）",
                content: json(z.array(catalogItemSchema)),
            },
        },
    }),

    createRoute({
        method: "get",
        path: "/api/works/mine",
        tags: ["作品"],
        summary: "我的作品",
        security: secure,
        responses: {
            200: {
                description: "当前用户创建的作品",
                content: json(z.array(ownedWorkSchema)),
            },
            ...errors,
        },
    }),

    createRoute({
        method: "get",
        path: "/api/works/{id}",
        tags: ["作品"],
        summary: "作品详情",
        description: "草稿仅作者本人可见；已发布作品公开可读。",
        request: {
            params: z.object({ id: z.string() }),
        },
        responses: {
            200: {
                description: "作品详情（含文件列表）",
                content: json(workDetailSchema),
            },
            404: {
                description: "作品不存在或无权限",
                content: json(errorSchema),
            },
        },
    }),

    createRoute({
        method: "post",
        path: "/api/works",
        tags: ["作品"],
        summary: "创建作品",
        security: secure,
        request: {
            body: {
                content: {
                    "multipart/form-data": {
                        schema: z.object({
                            title: z.string(),
                            description: z.string().optional(),
                            tags: z.string().optional().describe("逗号分隔"),
                            files: z
                                .any()
                                .optional()
                                .describe(
                                    "初始文件（File 对象，key 为文件名）",
                                ),
                        }),
                    },
                },
            },
        },
        responses: {
            201: {
                description: "创建成功",
                content: json(
                    z.object({
                        id: z.string(),
                        title: z.string(),
                        files: z.number(),
                    }),
                ),
            },
            ...errors,
        },
    }),

    createRoute({
        method: "post",
        path: "/api/works/{id}/publish",
        tags: ["作品"],
        summary: "发布作品",
        security: secure,
        request: {
            params: z.object({ id: z.string() }),
        },
        responses: {
            200: {
                description: "发布成功",
                content: json(
                    z.object({
                        ok: z.literal(true),
                        id: z.string(),
                        status: z.literal("published"),
                    }),
                ),
            },
            400: {
                description: "没有可发布的文件",
                content: json(errorSchema),
            },
            404: { description: "作品不存在", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "patch",
        path: "/api/works/{id}",
        tags: ["作品"],
        summary: "修改作品标题",
        security: secure,
        request: {
            params: z.object({ id: z.string() }),
            body: {
                content: json(z.object({ title: z.string().min(1) })),
            },
        },
        responses: {
            200: {
                description: "修改成功",
                content: json(z.object({ id: z.string(), title: z.string() })),
            },
            400: { description: "标题不能为空", content: json(errorSchema) },
            404: { description: "作品不存在", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "get",
        path: "/api/works/{id}/files",
        tags: ["文件"],
        summary: "文件列表",
        request: {
            params: z.object({ id: z.string() }),
        },
        responses: {
            200: {
                description: "作品文件列表",
                content: json(z.object({ files: z.array(workFileSchema) })),
            },
            404: { description: "作品不存在", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "get",
        path: "/api/works/{id}/files/content",
        tags: ["文件"],
        summary: "读取文件内容",
        request: {
            params: z.object({ id: z.string() }),
            query: z.object({ key: z.string().describe("文件存储 key") }),
        },
        responses: {
            200: {
                description: "文件文本内容",
                content: { "text/plain": { schema: z.string() } },
            },
            400: { description: "缺少 key", content: json(errorSchema) },
            404: { description: "文件不存在", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "post",
        path: "/api/works/{id}/files",
        tags: ["文件"],
        summary: "新建文件",
        security: secure,
        request: {
            params: z.object({ id: z.string() }),
            body: {
                content: json(
                    z.object({
                        name: z.string().describe("文件名（含后缀）"),
                        content: z.string(),
                        isBase64: z.boolean().optional(),
                        contentType: z.string().optional(),
                    }),
                ),
            },
        },
        responses: {
            201: {
                description: "创建成功",
                content: json(
                    z.object({
                        ok: z.literal(true),
                        key: z.string(),
                        name: z.string(),
                        size: z.number(),
                        version: z.number(),
                    }),
                ),
            },
            400: {
                description: "文件名不合法或内容超限",
                content: json(errorSchema),
            },
            404: { description: "作品不存在", content: json(errorSchema) },
            409: { description: "同名文件已存在", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "put",
        path: "/api/works/{id}/files/content",
        tags: ["文件"],
        summary: "更新文件内容",
        security: secure,
        request: {
            params: z.object({ id: z.string() }),
            body: {
                content: json(
                    z.object({
                        key: z.string(),
                        content: z.string(),
                        isBase64: z.boolean().optional(),
                        expectedVersion: z
                            .number()
                            .optional()
                            .describe("乐观锁版本号"),
                    }),
                ),
            },
        },
        responses: {
            200: {
                description: "更新成功",
                content: json(
                    z.object({
                        ok: z.literal(true),
                        key: z.string(),
                        size: z.number(),
                        version: z.number(),
                    }),
                ),
            },
            400: {
                description: "参数不合法或版本冲突",
                content: json(errorSchema),
            },
            404: { description: "文件不存在", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "patch",
        path: "/api/works/{id}/files",
        tags: ["文件"],
        summary: "重命名文件",
        security: secure,
        request: {
            params: z.object({ id: z.string() }),
            body: {
                content: json(
                    z.object({ key: z.string(), newName: z.string() }),
                ),
            },
        },
        responses: {
            200: {
                description: "重命名成功",
                content: json(
                    z.object({
                        ok: z.literal(true),
                        key: z.string(),
                        name: z.string(),
                        size: z.number(),
                        version: z.number(),
                    }),
                ),
            },
            400: { description: "文件名不合法", content: json(errorSchema) },
            404: { description: "文件不存在", content: json(errorSchema) },
            409: { description: "同名文件已存在", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "delete",
        path: "/api/works/{id}/files",
        tags: ["文件"],
        summary: "删除文件",
        security: secure,
        request: {
            params: z.object({ id: z.string() }),
            query: z.object({ key: z.string() }),
        },
        responses: {
            200: {
                description: "删除成功",
                content: json(z.object({ ok: z.literal(true) })),
            },
            404: { description: "文件不存在", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "delete",
        path: "/api/works/{id}/files/folder",
        tags: ["文件"],
        summary: "删除文件夹",
        security: secure,
        request: {
            params: z.object({ id: z.string() }),
            query: z.object({
                name: z.string().describe("文件夹名（顶层目录名）"),
            }),
        },
        responses: {
            200: {
                description: "删除成功",
                content: json(
                    z.object({ ok: z.literal(true), deleted: z.number() }),
                ),
            },
            404: {
                description: "文件夹为空或不存在",
                content: json(errorSchema),
            },
        },
    }),

    createRoute({
        method: "get",
        path: "/api/works/{id}/versions",
        tags: ["版本"],
        summary: "版本列表",
        description: "支持 ETag 协商（If-None-Match 命中返回 304）。",
        request: {
            params: z.object({ id: z.string() }),
        },
        responses: {
            200: {
                description: "版本列表（新→旧）",
                content: json(z.array(workVersionSchema)),
            },
            304: { description: "ETag 命中，无更新" },
            404: { description: "作品不存在", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "get",
        path: "/api/works/{id}/versions/{version}",
        tags: ["版本"],
        summary: "读取版本快照",
        request: {
            params: z.object({
                id: z.string(),
                version: z.string().describe("版本号"),
            }),
        },
        responses: {
            200: {
                description: "快照（文件内容内联返回）",
                content: json(snapshotSchema),
            },
            400: { description: "版本号不合法", content: json(errorSchema) },
            404: { description: "版本不存在", content: json(errorSchema) },
            500: { description: "快照数据丢失", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "post",
        path: "/api/works/{id}/versions",
        tags: ["版本"],
        summary: "基于当前工作区提交版本",
        security: secure,
        description:
            "用当前工作区全量内容生成新版本（等价于 git commit 当前状态）。",
        request: {
            params: z.object({ id: z.string() }),
            body: {
                content: json(z.object({ message: z.string().optional() })),
            },
        },
        responses: {
            201: {
                description: "提交成功",
                content: json(committedResponseSchema),
            },
            ...errors,
        },
    }),

    createRoute({
        method: "put",
        path: "/api/works/{id}/versions",
        tags: ["版本"],
        summary: "整树提交（git 式 commit）",
        security: secure,
        description:
            "一次请求原子替换工作区并生成版本。`files` 传完整文件树，`manifest` 传对象哈希引用（配合先增量上传缺失对象）。携带 `baseVersion` 时校验版本，不匹配返回 409 与最新版本号。",
        request: {
            params: z.object({ id: z.string() }),
            body: { content: json(commitTreeSchema) },
        },
        responses: {
            201: {
                description: "提交成功",
                content: json(committedResponseSchema),
            },
            200: {
                description: "无变化，未生成新版本",
                content: json(unchangedResponseSchema),
            },
            409: {
                description: "baseVersion 冲突（非快进）",
                content: json(conflictResponseSchema),
            },
            400: { description: "请求体不合法", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "post",
        path: "/api/works/{id}/versions/{version}/restore",
        tags: ["版本"],
        summary: "回滚到指定版本",
        security: secure,
        description: "将工作区文件精确还原到目标版本（含删除多余文件）。",
        request: {
            params: z.object({ id: z.string(), version: z.string() }),
        },
        responses: {
            200: {
                description: "回滚成功",
                content: json(
                    z.object({
                        ok: z.literal(true),
                        restoredVersion: z.number(),
                        files: z.number(),
                    }),
                ),
            },
            400: { description: "版本号不合法", content: json(errorSchema) },
            404: { description: "版本不存在", content: json(errorSchema) },
            500: { description: "快照数据丢失", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "delete",
        path: "/api/works/{id}/versions/{version}",
        tags: ["版本"],
        summary: "删除版本",
        security: secure,
        request: {
            params: z.object({ id: z.string(), version: z.string() }),
        },
        responses: {
            200: {
                description: "删除成功",
                content: json(
                    z.object({
                        ok: z.literal(true),
                        deletedVersion: z.number(),
                    }),
                ),
            },
            400: { description: "版本号不合法", content: json(errorSchema) },
            404: { description: "版本不存在", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "patch",
        path: "/api/works/{id}/versions/{version}",
        tags: ["版本"],
        summary: "修改版本提交信息",
        security: secure,
        request: {
            params: z.object({ id: z.string(), version: z.string() }),
            body: {
                content: json(z.object({ message: z.string().optional() })),
            },
        },
        responses: {
            200: {
                description: "修改成功",
                content: json(
                    z.object({
                        ok: z.literal(true),
                        version: z.number(),
                        message: z.string().nullable(),
                    }),
                ),
            },
            400: { description: "版本号不合法", content: json(errorSchema) },
            404: { description: "版本不存在", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "get",
        path: "/api/works/{id}/repo",
        tags: ["裸仓库"],
        summary: "仓库清单",
        description:
            "返回 head/refs/objects，客户端可据此增量同步（支持 ETag 协商）。",
        request: {
            params: z.object({ id: z.string() }),
        },
        responses: {
            200: { description: "仓库清单", content: json(repoManifestSchema) },
            304: { description: "ETag 命中，无更新" },
            404: { description: "作品不存在", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "get",
        path: "/api/works/{id}/commits/{hash}",
        tags: ["裸仓库"],
        summary: "按哈希读取提交对象",
        description: "内容寻址，响应带 immutable 缓存。",
        request: {
            params: z.object({ id: z.string(), hash: sha256 }),
        },
        responses: {
            200: { description: "提交对象", content: json(snapshotSchema) },
            400: { description: "哈希不合法", content: json(errorSchema) },
            404: { description: "提交不存在", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "get",
        path: "/api/works/{id}/objects/{hash}",
        tags: ["裸仓库"],
        summary: "按哈希读取 blob 原始字节",
        description: "内容寻址，响应带 immutable 缓存。",
        request: {
            params: z.object({ id: z.string(), hash: sha256 }),
        },
        responses: {
            200: {
                description: "对象原始字节",
                content: {
                    "application/octet-stream": {
                        schema: z.string().describe("原始二进制"),
                    },
                },
            },
            400: { description: "哈希不合法", content: json(errorSchema) },
            404: { description: "对象不存在", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "post",
        path: "/api/works/{id}/objects/missing",
        tags: ["裸仓库"],
        summary: "增量协商：计算缺失对象",
        security: secure,
        description:
            "客户端提交 has（本端已有对象哈希），服务端返回需要上传的 missing 列表。",
        request: {
            params: z.object({ id: z.string() }),
            body: {
                content: json(
                    z.object({
                        has: z
                            .array(sha256)
                            .describe("客户端已有对象哈希，上限 100000"),
                    }),
                ),
            },
        },
        responses: {
            200: {
                description: "缺失对象列表",
                content: json(z.object({ missing: z.array(sha256) })),
            },
            ...errors,
        },
    }),

    createRoute({
        method: "post",
        path: "/api/works/{id}/objects",
        tags: ["裸仓库"],
        summary: "批量上传对象（base64 JSON）",
        security: secure,
        description:
            "objects 为 hash → base64 内容映射；内容哈希不匹配返回 400。",
        request: {
            params: z.object({ id: z.string() }),
            body: {
                content: json(
                    z.object({
                        objects: z.record(
                            sha256,
                            z.string().describe("base64 内容"),
                        ),
                    }),
                ),
            },
        },
        responses: {
            200: {
                description: "上传成功",
                content: json(
                    z.object({ ok: z.literal(true), uploaded: z.number() }),
                ),
            },
            ...errors,
        },
    }),

    createRoute({
        method: "put",
        path: "/api/works/{id}/objects/{hash}",
        tags: ["裸仓库"],
        summary: "原始字节上传对象",
        security: secure,
        description: "请求体为对象原始字节，服务端校验 sha256 与路径哈希一致。",
        request: {
            params: z.object({ id: z.string(), hash: sha256 }),
            body: {
                content: {
                    "application/octet-stream": {
                        schema: z.string().describe("对象原始字节"),
                    },
                },
            },
        },
        responses: {
            200: {
                description: "上传成功",
                content: json(
                    z.object({ ok: z.literal(true), uploaded: z.number() }),
                ),
            },
            ...errors,
        },
    }),

    createRoute({
        method: "post",
        path: "/api/works/import/git",
        tags: ["Git"],
        summary: "从 Git 仓库导入作品",
        security: secure,
        description: "异步任务：返回 jobId，通过 events 端点订阅进度（SSE）。",
        request: {
            body: {
                content: json(
                    z.object({
                        repoUrl: z.string().url().describe("远程仓库地址"),
                        ref: z
                            .string()
                            .optional()
                            .describe("导入的分支/tag，默认 HEAD"),
                        depth: z
                            .number()
                            .int()
                            .min(1)
                            .optional()
                            .describe("浅克隆深度"),
                        title: z
                            .string()
                            .optional()
                            .describe("作品标题，默认取仓库名"),
                    }),
                ),
            },
        },
        responses: {
            202: {
                description: "任务已创建",
                content: json(z.object({ jobId: z.string() })),
            },
            400: { description: "缺少仓库地址", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "post",
        path: "/api/works/import/git/jobs/{jobId}/cancel",
        tags: ["Git"],
        summary: "取消导入任务",
        security: secure,
        request: {
            params: z.object({ jobId: z.string() }),
        },
        responses: {
            200: {
                description: "取消结果",
                content: json(
                    z.object({
                        ok: z.literal(true),
                        cancelled: z.boolean(),
                        jobId: z.string(),
                    }),
                ),
            },
            403: { description: "无权操作", content: json(errorSchema) },
            404: {
                description: "任务不存在或已过期",
                content: json(errorSchema),
            },
        },
    }),

    createRoute({
        method: "get",
        path: "/api/works/import/git/jobs/{jobId}/events",
        tags: ["Git"],
        summary: "导入任务进度（SSE）",
        security: secure,
        description:
            "Server-Sent Events：progress/done/error/cancelled 四种事件，data 为 {status, percent, stage, message, result?, error?}。",
        request: {
            params: z.object({ jobId: z.string() }),
        },
        responses: {
            200: {
                description: "SSE 事件流",
                content: {
                    "text/event-stream": {
                        schema: z.string(),
                    },
                },
            },
        },
    }),

    createRoute({
        method: "get",
        path: "/api/works/{id}/export/git",
        tags: ["Git"],
        summary: "导出为 Git 仓库 zip",
        security: secure,
        description: "把作品的版本历史构建为裸 git 仓库并打包下载。",
        request: {
            params: z.object({ id: z.string() }),
        },
        responses: {
            200: {
                description: "git 仓库 zip 文件",
                content: { "application/zip": { schema: z.string() } },
            },
            500: { description: "导出失败", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "post",
        path: "/api/works/{id}/export/git/push",
        tags: ["Git"],
        summary: "推送作品到远程 Git 仓库",
        security: secure,
        description:
            "将作品全部提交推送到远程仓库（内置 git 实现，无需本地 git）。",
        request: {
            params: z.object({ id: z.string() }),
            body: {
                content: json(
                    z.object({
                        url: z.string().describe("远程仓库地址"),
                        token: z.string().describe("访问令牌"),
                        ref: z
                            .string()
                            .optional()
                            .describe("目标分支，默认 HEAD"),
                        force: z.boolean().optional().describe("是否强制推送"),
                    }),
                ),
            },
        },
        responses: {
            200: {
                description: "推送结果",
                content: json(
                    z.object({
                        ok: z.literal(true),
                        pushedRef: z.string(),
                        commitCount: z.number(),
                    }),
                ),
            },
            400: {
                description: "缺少远程地址或令牌",
                content: json(errorSchema),
            },
            500: { description: "推送失败", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "get",
        path: "/api/works/{id}/comments",
        tags: ["社交"],
        summary: "评论列表",
        request: {
            params: z.object({ id: z.string() }),
        },
        responses: {
            200: {
                description: "评论列表（平铺，按 parentId 组织层级）",
                content: json(z.array(commentSchema)),
            },
            404: { description: "作品不存在", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "post",
        path: "/api/works/{id}/comments",
        tags: ["社交"],
        summary: "发表评论",
        security: secure,
        request: {
            params: z.object({ id: z.string() }),
            body: {
                content: json(
                    z.object({
                        content: z.string().min(1).max(1000),
                        parentId: z
                            .string()
                            .optional()
                            .describe("回复的评论 id"),
                    }),
                ),
            },
        },
        responses: {
            201: { description: "评论已创建", content: json(commentSchema) },
            400: {
                description: "评论内容为空或父评论不存在",
                content: json(errorSchema),
            },
            404: { description: "作品不存在", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "get",
        path: "/api/works/{id}/spark",
        tags: ["社交"],
        summary: "查询火花状态",
        security: secure,
        request: {
            params: z.object({ id: z.string() }),
        },
        responses: {
            200: {
                description: "是否已送火花",
                content: json(z.object({ sparked: z.boolean() })),
            },
            404: { description: "作品不存在", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "post",
        path: "/api/works/{id}/spark",
        tags: ["社交"],
        summary: "送出火花",
        security: secure,
        description: "每天火花有限；不能给自己的作品送火花。",
        request: {
            params: z.object({ id: z.string() }),
        },
        responses: {
            200: {
                description: "送出成功",
                content: json(z.object({ sparked: z.literal(true) })),
            },
            400: {
                description: "不能给自己送火花或火花不足",
                content: json(errorSchema),
            },
            404: { description: "作品不存在", content: json(errorSchema) },
            409: { description: "已送过火花", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "post",
        path: "/api/works/{id}/remix",
        tags: ["社交"],
        summary: "Remix 作品",
        security: secure,
        description: "复制作品内容生成新的派生作品。",
        request: {
            params: z.object({ id: z.string() }),
        },
        responses: {
            201: {
                description: "派生作品已创建",
                content: json(z.object({ id: z.string(), title: z.string() })),
            },
            400: {
                description: "不能 remix 自己的作品",
                content: json(errorSchema),
            },
            404: { description: "作品不存在", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "get",
        path: "/api/works/{id}/source",
        tags: ["社交"],
        summary: "查询来源作品",
        request: {
            params: z.object({ id: z.string() }),
        },
        responses: {
            200: {
                description: "来源作品（无来源时为 null）",
                content: json(workSourceSchema.nullable()),
            },
            404: { description: "作品不存在", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "get",
        path: "/api/works/{id}/remixes",
        tags: ["社交"],
        summary: "派生作品列表",
        request: {
            params: z.object({ id: z.string() }),
        },
        responses: {
            200: {
                description: "派生作品摘要列表",
                content: json(z.array(workSummarySchema)),
            },
            404: { description: "作品不存在", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "get",
        path: "/api/works/{id}/tree",
        tags: ["社交"],
        summary: "Remix 关系树",
        request: {
            params: z.object({ id: z.string() }),
        },
        responses: {
            200: {
                description: "来源与派生关系",
                content: json(remixTreeSchema),
            },
            404: { description: "作品不存在", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "get",
        path: "/api/works/{id}/bookmark",
        tags: ["社交"],
        summary: "查询收藏状态",
        security: secure,
        request: {
            params: z.object({ id: z.string() }),
        },
        responses: {
            200: {
                description: "是否已收藏",
                content: json(z.object({ bookmarked: z.boolean() })),
            },
            404: { description: "作品不存在", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "post",
        path: "/api/works/{id}/bookmark",
        tags: ["社交"],
        summary: "收藏作品",
        security: secure,
        request: {
            params: z.object({ id: z.string() }),
        },
        responses: {
            200: {
                description: "收藏成功",
                content: json(z.object({ bookmarked: z.literal(true) })),
            },
            400: {
                description: "不能收藏自己的作品",
                content: json(errorSchema),
            },
            404: { description: "作品不存在", content: json(errorSchema) },
            409: { description: "已收藏", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "delete",
        path: "/api/works/{id}/bookmark",
        tags: ["社交"],
        summary: "取消收藏",
        security: secure,
        request: {
            params: z.object({ id: z.string() }),
        },
        responses: {
            200: {
                description: "取消成功",
                content: json(z.object({ bookmarked: z.literal(false) })),
            },
            404: { description: "未收藏该作品", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "get",
        path: "/api/works/user/{userId}/bookmarks",
        tags: ["社交"],
        summary: "用户的收藏列表",
        security: secure,
        description: "仅本人或允许公开收藏列表的用户可查看。",
        request: {
            params: z.object({ userId: z.string() }),
            query: z.object({
                limit: z.number().int().min(1).max(50).optional(),
                offset: z.number().int().min(0).optional(),
            }),
        },
        responses: {
            200: {
                description: "收藏的作品摘要列表",
                content: json(z.array(workSummarySchema)),
            },
            403: {
                description: "该用户的收藏列表不公开",
                content: json(errorSchema),
            },
        },
    }),

    createRoute({
        method: "post",
        path: "/api/works/{id}/report",
        tags: ["社交"],
        summary: "举报作品",
        security: secure,
        request: {
            params: z.object({ id: z.string() }),
            body: {
                content: json(
                    z.object({
                        reason: z.string().min(1).describe("举报原因"),
                    }),
                ),
            },
        },
        responses: {
            200: {
                description: "重复举报（已举报过）",
                content: json(
                    z.object({
                        ok: z.literal(true),
                        id: z.string(),
                        reReported: z.literal(true),
                    }),
                ),
            },
            201: {
                description: "举报已受理",
                content: json(
                    z.object({
                        ok: z.literal(true),
                        id: z.string(),
                        reReported: z.literal(false),
                    }),
                ),
            },
            400: { description: "请填写举报原因", content: json(errorSchema) },
            404: { description: "作品不存在", content: json(errorSchema) },
        },
    }),

    createRoute({
        method: "get",
        path: "/api/works/leaderboard",
        tags: ["排行"],
        summary: "排行榜",
        description: "type=works 返回作品榜，type=contributors 返回贡献者榜。",
        request: {
            query: z.object({
                period: z.enum(["weekly", "monthly", "all"]).optional(),
                type: z.enum(["works", "contributors"]).optional(),
                limit: z.number().int().min(1).max(50).optional(),
            }),
        },
        responses: {
            200: {
                description: "排行榜条目（按 type 返回作品或贡献者形态）",
                content: json(
                    z.union([
                        z.array(workLeaderboardItemSchema),
                        z.array(contributorLeaderboardItemSchema),
                    ]),
                ),
            },
        },
    }),

    createRoute({
        method: "get",
        path: "/api/notifications",
        tags: ["通知"],
        summary: "通知列表",
        security: secure,
        responses: {
            200: {
                description: "通知列表",
                content: json(z.array(notificationSchema)),
            },
            ...errors,
        },
    }),

    createRoute({
        method: "get",
        path: "/api/notifications/unread-count",
        tags: ["通知"],
        summary: "未读通知数",
        security: secure,
        responses: {
            200: {
                description: "未读数",
                content: json(z.object({ count: z.number() })),
            },
            ...errors,
        },
    }),

    createRoute({
        method: "post",
        path: "/api/notifications/read-all",
        tags: ["通知"],
        summary: "全部标为已读",
        security: secure,
        responses: {
            200: {
                description: "操作成功",
                content: json(z.object({ ok: z.literal(true) })),
            },
            ...errors,
        },
    }),

    createRoute({
        method: "post",
        path: "/api/notifications/{id}/read",
        tags: ["通知"],
        summary: "单条标为已读",
        security: secure,
        request: {
            params: z.object({ id: z.string() }),
        },
        responses: {
            200: {
                description: "操作成功（返回最新未读数）",
                content: json(
                    z.object({ ok: z.literal(true), unreadCount: z.number() }),
                ),
            },
            ...errors,
        },
    }),
];
