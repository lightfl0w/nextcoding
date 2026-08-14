import { relations, sql } from "drizzle-orm";
import {
    index,
    integer,
    sqliteTable,
    text,
    uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { work } from "./works.js";

export const tag = sqliteTable(
    "tag",
    {
        id: text("id").primaryKey(),
        name: text("name").notNull(),
        slug: text("slug").notNull(),
        description: text("description"),
        color: text("color"),
        workCount: integer("work_count").default(0).notNull(),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
    },
    (table) => [
        uniqueIndex("tag_slug_unique").on(table.slug),
        index("tag_workCount_idx").on(table.workCount),
    ],
);

export const workTag = sqliteTable(
    "work_tag",
    {
        id: text("id").primaryKey(),
        workId: text("work_id")
            .notNull()
            .references(() => work.id, { onDelete: "cascade" }),
        tagId: text("tag_id")
            .notNull()
            .references(() => tag.id, { onDelete: "cascade" }),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
    },
    (table) => [
        uniqueIndex("work_tag_unique").on(table.workId, table.tagId),
        index("work_tag_tagId_idx").on(table.tagId),
    ],
);

export const tagRelations = relations(tag, ({ many }) => ({
    works: many(workTag),
}));

export const workTagRelations = relations(workTag, ({ one }) => ({
    work: one(work, { fields: [workTag.workId], references: [work.id] }),
    tag: one(tag, { fields: [workTag.tagId], references: [tag.id] }),
}));
