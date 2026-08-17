import { relations, sql } from "drizzle-orm";
import {
    index,
    integer,
    sqliteTable,
    text,
    uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth.js";

export const conversation = sqliteTable(
    "conversation",
    {
        id: text("id").primaryKey(),
        user1Id: text("user1_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        user2Id: text("user2_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        lastMessageAt: integer("last_message_at", { mode: "timestamp_ms" }),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
    },
    (table) => [
        uniqueIndex("conversation_users_unique").on(
            table.user1Id,
            table.user2Id,
        ),
    ],
);

export const message = sqliteTable(
    "message",
    {
        id: text("id").primaryKey(),
        conversationId: text("conversation_id")
            .notNull()
            .references(() => conversation.id, { onDelete: "cascade" }),
        senderId: text("sender_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        content: text("content").notNull(),
        read: integer("read", { mode: "boolean" }).default(false).notNull(),
        recalled: integer("recalled", { mode: "boolean" })
            .default(false)
            .notNull(),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
    },
    (table) => [
        index("message_conversationId_createdAt_idx").on(
            table.conversationId,
            table.createdAt,
        ),
        index("message_senderId_idx").on(table.senderId),
    ],
);

export const conversationRelations = relations(
    conversation,
    ({ one, many }) => ({
        user1: one(user, {
            fields: [conversation.user1Id],
            references: [user.id],
        }),
        user2: one(user, {
            fields: [conversation.user2Id],
            references: [user.id],
        }),
        messages: many(message),
    }),
);

export const messageRelations = relations(message, ({ one }) => ({
    conversation: one(conversation, {
        fields: [message.conversationId],
        references: [conversation.id],
    }),
    sender: one(user, {
        fields: [message.senderId],
        references: [user.id],
    }),
}));
