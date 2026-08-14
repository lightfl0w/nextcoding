import { relations, sql } from "drizzle-orm";
import {
    integer,
    sqliteTable,
    text,
    uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth.js";

export const userSettings = sqliteTable(
    "user_settings",
    {
        id: text("id").primaryKey(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        notifyOnSpark: integer("notify_on_spark", { mode: "boolean" })
            .default(true)
            .notNull(),
        notifyOnRemix: integer("notify_on_remix", { mode: "boolean" })
            .default(true)
            .notNull(),
        notifyOnComment: integer("notify_on_comment", { mode: "boolean" })
            .default(true)
            .notNull(),
        notifyOnFollow: integer("notify_on_follow", { mode: "boolean" })
            .default(true)
            .notNull(),
        notifyOnMessage: integer("notify_on_message", { mode: "boolean" })
            .default(true)
            .notNull(),
        showActivity: integer("show_activity", { mode: "boolean" })
            .default(true)
            .notNull(),
        showBookmarks: integer("show_bookmarks", { mode: "boolean" })
            .default(false)
            .notNull(),
        editorFontSize: integer("editor_font_size").default(14).notNull(),
        editorFontFamily: text("editor_font_family")
            .default("monospace")
            .notNull(),
        editorTabSize: integer("editor_tab_size").default(2).notNull(),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp_ms" })
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [uniqueIndex("user_settings_userId_unique").on(table.userId)],
);

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
    user: one(user, {
        fields: [userSettings.userId],
        references: [user.id],
    }),
}));
