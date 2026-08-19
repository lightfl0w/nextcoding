import { relations, sql } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth.js";
import { work } from "./works.js";

export const template = sqliteTable(
    "template",
    {
        id: text("id").primaryKey(),
        authorId: text("author_id").references(() => user.id, {
            onDelete: "set null",
        }),
        workId: text("work_id").references(() => work.id, {
            onDelete: "set null",
        }),
        title: text("title").notNull(),
        description: text("description"),
        category: text("category"),
        tags: text("tags").default("[]").notNull(),
        coverUrl: text("cover_url"),
        status: text("status", {
            enum: ["pending", "published", "rejected"],
        })
            .default("pending")
            .notNull(),
        reviewedBy: text("reviewed_by").references(() => user.id, {
            onDelete: "set null",
        }),
        reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
        fileCount: integer("file_count").default(0).notNull(),
        useCount: integer("use_count").default(0).notNull(),
        rating: integer("rating").default(0).notNull(),
        ratingCount: integer("rating_count").default(0).notNull(),
        snapshotKey: text("snapshot_key").notNull(),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp_ms" })
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        index("template_category_idx").on(table.category),
        index("template_authorId_idx").on(table.authorId),
    ],
);

export const templateUse = sqliteTable(
    "template_use",
    {
        id: text("id").primaryKey(),
        templateId: text("template_id")
            .notNull()
            .references(() => template.id, { onDelete: "cascade" }),
        workId: text("work_id")
            .notNull()
            .references(() => work.id, { onDelete: "cascade" }),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
    },
    (table) => [
        index("template_use_templateId_idx").on(table.templateId),
        index("template_use_workId_idx").on(table.workId),
    ],
);

export const templateComment = sqliteTable(
    "template_comment",
    {
        id: text("id").primaryKey(),
        templateId: text("template_id")
            .notNull()
            .references(() => template.id, { onDelete: "cascade" }),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        parentId: text("parent_id").references(
            (): AnySQLiteColumn => templateComment.id,
            { onDelete: "cascade" },
        ),
        content: text("content").notNull(),
        pinned: integer("pinned", { mode: "boolean" }).default(false).notNull(),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
    },
    (table) => [
        index("template_comment_templateId_idx").on(table.templateId),
        index("template_comment_parentId_idx").on(table.parentId),
    ],
);

export const templateCommentLike = sqliteTable(
    "template_comment_like",
    {
        commentId: text("comment_id")
            .notNull()
            .references(() => templateComment.id, { onDelete: "cascade" }),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.commentId, table.userId] }),
        index("template_comment_like_userId_idx").on(table.userId),
    ],
);

export const templateRelations = relations(template, ({ one, many }) => ({
    author: one(user, {
        fields: [template.authorId],
        references: [user.id],
    }),
    uses: many(templateUse),
    comments: many(templateComment),
}));

export const templateUseRelations = relations(templateUse, ({ one }) => ({
    template: one(template, {
        fields: [templateUse.templateId],
        references: [template.id],
    }),
    work: one(work, {
        fields: [templateUse.workId],
        references: [work.id],
    }),
    user: one(user, {
        fields: [templateUse.userId],
        references: [user.id],
    }),
}));

export const templateCommentRelations = relations(
    templateComment,
    ({ one, many }) => ({
        template: one(template, {
            fields: [templateComment.templateId],
            references: [template.id],
        }),
        author: one(user, {
            fields: [templateComment.userId],
            references: [user.id],
        }),
        parent: one(templateComment, {
            fields: [templateComment.parentId],
            references: [templateComment.id],
        }),
        replies: many(templateComment),
    }),
);
