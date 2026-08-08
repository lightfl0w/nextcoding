import { relations, sql } from "drizzle-orm";
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
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
    },
    (table) => [index("work_file_workId_idx").on(table.workId)],
);

export const workRelations = relations(work, ({ many, one }) => ({
    author: one(user, {
        fields: [work.userId],
        references: [user.id],
    }),
    files: many(workFile),
}));

export const workFileRelations = relations(workFile, ({ one }) => ({
    work: one(work, {
        fields: [workFile.workId],
        references: [work.id],
    }),
}));
