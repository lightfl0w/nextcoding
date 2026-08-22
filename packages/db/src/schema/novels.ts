import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth.js";

/**
 * 小说 / 文章：一部作品对应多个章节。
 */
export const novel = sqliteTable(
    "novel",
    {
        id: text("id").primaryKey(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        title: text("title").notNull(),
        description: text("description"),
        coverUrl: text("cover_url"),
        // 发布状态：false = 草稿（仅作者可见），true = 已发布（所有人可见）。
        published: integer("published", { mode: "boolean" })
            .notNull()
            .default(false),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp_ms" })
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [index("novel_userId_idx").on(table.userId)],
);

/**
 * 章节：归属某一部小说，按 `position` 升序排列。
 * `content` 存储 Tiptap 生成的 HTML 片段。
 */
export const chapter = sqliteTable(
    "chapter",
    {
        id: text("id").primaryKey(),
        novelId: text("novel_id")
            .notNull()
            .references(() => novel.id, { onDelete: "cascade" }),
        title: text("title").notNull(),
        content: text("content").default("").notNull(),
        position: integer("position").default(0).notNull(),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp_ms" })
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [index("chapter_novelId_idx").on(table.novelId)],
);

export const novelRelations = relations(novel, ({ one, many }) => ({
    author: one(user, {
        fields: [novel.userId],
        references: [user.id],
    }),
    chapters: many(chapter),
}));

export const chapterRelations = relations(chapter, ({ one }) => ({
    novel: one(novel, {
        fields: [chapter.novelId],
        references: [novel.id],
    }),
}));
