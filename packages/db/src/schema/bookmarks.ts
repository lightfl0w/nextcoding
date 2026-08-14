import { relations, sql } from "drizzle-orm";
import {
    index,
    integer,
    sqliteTable,
    text,
    uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth.js";
import { work } from "./works.js";

export const bookmark = sqliteTable(
    "bookmark",
    {
        id: text("id").primaryKey(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        workId: text("work_id")
            .notNull()
            .references(() => work.id, { onDelete: "cascade" }),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
    },
    (table) => [
        uniqueIndex("bookmark_user_work_unique").on(table.userId, table.workId),
        index("bookmark_userId_idx").on(table.userId),
    ],
);

export const bookmarkRelations = relations(bookmark, ({ one }) => ({
    user: one(user, { fields: [bookmark.userId], references: [user.id] }),
    work: one(work, { fields: [bookmark.workId], references: [work.id] }),
}));
