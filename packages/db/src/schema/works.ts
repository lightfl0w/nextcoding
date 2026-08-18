import { relations, sql } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth.js";

export const work = sqliteTable(
    "work",
    {
        id: text("id").primaryKey(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        title: text("title").notNull(),
        description: text("description"),
        coverUrl: text("cover_url"),
        tags: text("tags").default("[]").notNull(),
        status: text("status", { enum: ["draft", "published"] })
            .default("draft")
            .notNull(),
        views: integer("views").default(0).notNull(),
        likes: integer("likes").default(0).notNull(),
        sparks: integer("sparks").default(0).notNull(),
        isTemplate: integer("is_template", { mode: "boolean" })
            .default(false)
            .notNull(),
        templateUseCount: integer("template_use_count").default(0).notNull(),
        templateId: text("template_id"),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp_ms" })
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [index("work_userId_idx").on(table.userId)],
);

export const workFile = sqliteTable(
    "work_file",
    {
        id: text("id").primaryKey(),
        workId: text("work_id")
            .notNull()
            .references(() => work.id, { onDelete: "cascade" }),
        key: text("key").notNull(),
        name: text("name").notNull(),
        size: integer("size").notNull(),
        contentType: text("content_type"),
        version: integer("version").default(1).notNull(),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
    },
    (table) => [index("work_file_workId_idx").on(table.workId)],
);

export const workVersion = sqliteTable(
    "work_version",
    {
        id: text("id").primaryKey(),
        workId: text("work_id")
            .notNull()
            .references(() => work.id, { onDelete: "cascade" }),
        version: integer("version").notNull(),
        snapshotKey: text("snapshot_key").notNull(),
        message: text("message"),
        userId: text("user_id").references(() => user.id, {
            onDelete: "set null",
        }),
        tree: text("tree"),
        hash: text("hash"),
        parent: text("parent"),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
    },
    (table) => [index("work_version_workId_idx").on(table.workId)],
);

export const workComment = sqliteTable(
    "work_comment",
    {
        id: text("id").primaryKey(),
        workId: text("work_id")
            .notNull()
            .references(() => work.id, { onDelete: "cascade" }),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        parentId: text("parent_id").references(
            (): AnySQLiteColumn => workComment.id,
            { onDelete: "cascade" },
        ),
        content: text("content").notNull(),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
    },
    (table) => [
        index("work_comment_workId_idx").on(table.workId),
        index("work_comment_parentId_idx").on(table.parentId),
    ],
);

export const workRelations = relations(work, ({ many, one }) => ({
    author: one(user, {
        fields: [work.userId],
        references: [user.id],
    }),
    files: many(workFile),
    versions: many(workVersion),
    comments: many(workComment),
}));

export const workFileRelations = relations(workFile, ({ one }) => ({
    work: one(work, {
        fields: [workFile.workId],
        references: [work.id],
    }),
}));

export const workVersionRelations = relations(workVersion, ({ one }) => ({
    work: one(work, {
        fields: [workVersion.workId],
        references: [work.id],
    }),
    author: one(user, {
        fields: [workVersion.userId],
        references: [user.id],
    }),
}));

export const workCommentRelations = relations(workComment, ({ one, many }) => ({
    work: one(work, {
        fields: [workComment.workId],
        references: [work.id],
    }),
    author: one(user, {
        fields: [workComment.userId],
        references: [user.id],
    }),
    parent: one(workComment, {
        fields: [workComment.parentId],
        references: [workComment.id],
    }),
    replies: many(workComment),
}));
