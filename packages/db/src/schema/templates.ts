import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const template = sqliteTable(
    "template",
    {
        id: text("id").primaryKey(),
        title: text("title").notNull(),
        description: text("description"),
        category: text("category"),
        tags: text("tags").default("[]").notNull(),
        coverUrl: text("cover_url"),
        fileCount: integer("file_count").default(0).notNull(),
        useCount: integer("use_count").default(0).notNull(),
        snapshotKey: text("snapshot_key").notNull(),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp_ms" })
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [index("template_category_idx").on(table.category)],
);

export const templateRelations = relations(template, () => ({}));
