import { relations, sql } from "drizzle-orm";
import {
    index,
    integer,
    sqliteTable,
    text,
    uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth.js";
import { work, workComment } from "./works.js";

export const spark = sqliteTable(
    "spark",
    {
        id: text("id").primaryKey(),
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
        uniqueIndex("spark_user_work_unique").on(table.userId, table.workId),
        index("spark_workId_idx").on(table.workId),
        index("spark_createdAt_idx").on(table.createdAt),
    ],
);

export const remix = sqliteTable(
    "remix",
    {
        id: text("id").primaryKey(),
        originalId: text("original_id")
            .notNull()
            .references(() => work.id, { onDelete: "cascade" }),
        forkId: text("fork_id")
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
        uniqueIndex("remix_fork_unique").on(table.forkId),
        index("remix_originalId_idx").on(table.originalId),
    ],
);

export const notification = sqliteTable(
    "notification",
    {
        id: text("id").primaryKey(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        type: text("type", {
            enum: [
                "spark",
                "remix",
                "comment",
                "follow",
                "message",
                "achievement",
            ],
        }).notNull(),
        actorId: text("actor_id").references(() => user.id, {
            onDelete: "set null",
        }),
        workId: text("work_id").references(() => work.id, {
            onDelete: "set null",
        }),
        commentId: text("comment_id").references(() => workComment.id, {
            onDelete: "cascade",
        }),
        messageId: text("message_id"),
        achievementId: text("achievement_id"),
        read: integer("read", { mode: "boolean" }).default(false).notNull(),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
    },
    (table) => [
        index("notification_userId_read_idx").on(table.userId, table.read),
        index("notification_userId_createdAt_idx").on(
            table.userId,
            table.createdAt,
        ),
    ],
);

export const follow = sqliteTable(
    "follow",
    {
        id: text("id").primaryKey(),
        followerId: text("follower_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        followingId: text("following_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
    },
    (table) => [
        uniqueIndex("follow_unique").on(table.followerId, table.followingId),
        index("follow_followingId_idx").on(table.followingId),
    ],
);

export const sparkBalance = sqliteTable("spark_balance", {
    userId: text("user_id")
        .primaryKey()
        .references(() => user.id, { onDelete: "cascade" }),
    balance: integer("balance").notNull().default(0),
    lastGrantedAt: text("last_granted_at").notNull(),
});

export const sparkRelations = relations(spark, ({ one }) => ({
    work: one(work, { fields: [spark.workId], references: [work.id] }),
    user: one(user, { fields: [spark.userId], references: [user.id] }),
}));

export const remixRelations = relations(remix, ({ one }) => ({
    original: one(work, {
        fields: [remix.originalId],
        references: [work.id],
    }),
    fork: one(work, { fields: [remix.forkId], references: [work.id] }),
    user: one(user, { fields: [remix.userId], references: [user.id] }),
}));

export const notificationRelations = relations(notification, ({ one }) => ({
    recipient: one(user, {
        fields: [notification.userId],
        references: [user.id],
    }),
    actor: one(user, {
        fields: [notification.actorId],
        references: [user.id],
    }),
    work: one(work, {
        fields: [notification.workId],
        references: [work.id],
    }),
    comment: one(workComment, {
        fields: [notification.commentId],
        references: [workComment.id],
    }),
}));

export const followRelations = relations(follow, ({ one }) => ({
    follower: one(user, {
        fields: [follow.followerId],
        references: [user.id],
    }),
    following: one(user, {
        fields: [follow.followingId],
        references: [user.id],
    }),
}));
