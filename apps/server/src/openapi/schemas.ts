import { z } from "@hono/zod-openapi";

export const isoDate = z
    .string()
    .openapi({ format: "date-time", description: "ISO 8601 时间" });

export const epochMs = z.number().openapi({ description: "Unix 毫秒时间戳" });

export const sha256 = z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .openapi({
        pattern: "^[0-9a-f]{64}$",
        description: "SHA-256 十六进制哈希",
    });

export const workStatus = z.enum(["draft", "published"]);
export const notificationType = z.enum([
    "spark",
    "remix",
    "comment",
    "follow",
    "message",
    "achievement",
]);

export const errorSchema = z
    .object({
        error: z.string(),
    })
    .openapi("Error");

export const authorSchema = z
    .object({
        id: z.string().nullable(),
        name: z.string().nullable(),
        image: z.string().nullable(),
        bio: z.string().nullable(),
    })
    .openapi("Author");

export const versionAuthorSchema = z
    .object({
        id: z.string().nullable(),
        name: z.string().nullable(),
    })
    .openapi("VersionAuthor");

export const workFileSchema = z
    .object({
        id: z.string(),
        workId: z.string(),
        key: z.string().describe("存储 key（含 works/{id}/ 前缀）"),
        name: z.string(),
        size: z.number(),
        contentType: z.string().nullable(),
        version: z.number(),
        createdAt: isoDate,
    })
    .openapi("WorkFile");

export const workSummarySchema = z
    .object({
        id: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        coverUrl: z.string().nullable(),
        tags: z.array(z.string()),
        views: z.number(),
        likes: z.number(),
        sparks: z.number(),
        createdAt: isoDate,
        author: authorSchema,
    })
    .openapi("WorkSummary");

export const catalogItemSchema = workSummarySchema
    .extend({
        sparked: z.boolean(),
    })
    .openapi("CatalogItem");

export const ownedWorkSchema = z
    .object({
        id: z.string(),
        title: z.string(),
        status: workStatus,
        sparks: z.number(),
        views: z.number(),
        createdAt: isoDate,
        updatedAt: isoDate,
    })
    .openapi("OwnedWork");

export const workDetailSchema = workSummarySchema
    .extend({
        userId: z.string(),
        status: workStatus,
        updatedAt: isoDate,
        files: z.array(workFileSchema),
        author: authorSchema.extend({
            followers: z.number(),
            followedByMe: z.boolean(),
        }),
    })
    .openapi("WorkDetail");

export const snapshotFileSchema = z
    .object({
        key: z.string(),
        name: z.string(),
        contentType: z.string().nullable(),
        content: z.string().optional().describe("文件内容（取快照时内联返回）"),
        encoding: z
            .literal("base64")
            .optional()
            .describe("内容为 base64 时标记"),
        hash: z.string().optional().describe("内容寻址哈希"),
        size: z.number().optional(),
    })
    .openapi("SnapshotFile");

export const snapshotSchema = z
    .object({
        version: z.number(),
        message: z.string().nullable(),
        createdAt: epochMs,
        files: z.array(snapshotFileSchema),
        tree: z.string().optional(),
        hash: z.string().optional(),
        parent: z.string().nullable().optional(),
    })
    .openapi("Snapshot");

export const workVersionSchema = z
    .object({
        version: z.number(),
        message: z.string().nullable(),
        createdAt: isoDate,
        author: versionAuthorSchema.nullable(),
    })
    .openapi("WorkVersion");

export const repoRefSchema = z
    .object({
        version: z.number(),
        message: z.string().nullable(),
        createdAt: isoDate,
        tree: sha256,
        hash: sha256,
        parent: sha256.nullable(),
        author: versionAuthorSchema.nullable(),
    })
    .openapi("RepoRef");

export const repoManifestSchema = z
    .object({
        head: repoRefSchema.nullable().describe("最新提交 ref"),
        refs: z.array(repoRefSchema).describe("版本 ref 列表（新→旧）"),
        objects: z.array(sha256).describe("全部对象哈希（去重排序）"),
    })
    .openapi("RepoManifest");

export const inlineFileValueSchema = z.union([
    z.string().describe("文本内容"),
    z
        .object({
            b64: z.string().describe("base64 编码的二进制内容"),
            contentType: z.string().optional(),
        })
        .describe("二进制内容"),
]);

export const manifestFileValueSchema = z.union([
    sha256.describe("对象哈希"),
    z.object({
        hash: sha256,
        contentType: z.string().optional(),
    }),
]);

export const commitTreeSchema = z
    .object({
        message: z.string().optional(),
        baseVersion: z
            .number()
            .int()
            .nonnegative()
            .optional()
            .describe("乐观锁版本号；不匹配时返回 409"),
        files: z
            .record(z.string(), inlineFileValueSchema)
            .optional()
            .describe("完整文件树（name → 内容）"),
        manifest: z
            .record(z.string(), manifestFileValueSchema)
            .optional()
            .describe("name → 对象哈希 引用，配合先增量上传再提交"),
    })
    .openapi("CommitTreeRequest");

export const committedResponseSchema = z
    .object({
        id: z.string(),
        version: z.number(),
        message: z.string().nullable(),
        createdAt: isoDate,
        fileCount: z.number(),
        tree: sha256,
        hash: sha256,
    })
    .openapi("CommittedResponse");

export const unchangedResponseSchema = z
    .object({
        ok: z.literal(true),
        unchanged: z.literal(true),
        version: z.number(),
        tree: sha256,
    })
    .openapi("UnchangedResponse");

export const conflictResponseSchema = z
    .object({
        error: z.string(),
        currentVersion: z.number(),
    })
    .openapi("ConflictResponse");

export const commentSchema = z
    .object({
        id: z.string(),
        content: z.string(),
        parentId: z.string().nullable(),
        createdAt: isoDate,
        author: authorSchema,
    })
    .openapi("Comment");

export const notificationSchema = z
    .object({
        id: z.string(),
        type: notificationType,
        read: z.boolean(),
        createdAt: isoDate,
        actor: z
            .object({ id: z.string(), name: z.string().nullable() })
            .nullable(),
        work: z
            .object({ id: z.string(), title: z.string().nullable() })
            .nullable(),
        comment: z
            .object({ id: z.string(), content: z.string().nullable() })
            .nullable(),
    })
    .openapi("Notification");

export const workSourceSchema = z
    .object({
        id: z.string(),
        title: z.string(),
    })
    .openapi("WorkSource");

export const remixTreeSchema = z
    .object({
        source: workSourceSchema.nullable(),
        remixes: z.array(workSummarySchema),
    })
    .openapi("RemixTree");

export const workLeaderboardItemSchema = z
    .object({
        position: z.number(),
        work: workSummarySchema,
        sparks: z.number(),
    })
    .openapi("WorkLeaderboardItem");

export const contributorLeaderboardItemSchema = z
    .object({
        position: z.number(),
        author: authorSchema,
        totalSparks: z.number(),
    })
    .openapi("ContributorLeaderboardItem");
