import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth.js";
import { work, workComment } from "./works.js";

export const activity = sqliteTable(
    "activity",
    {
        id: text("id").primaryKey(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        type: text("type", {
            enum: ["spark", "remix", "comment", "publish", "follow"],
        }).notNull(),
        actorId: text("actor_id").references(() => user.id, {
            onDelete: "set null",
        }),
        workId: text("work_id").references(() => work.id, {
            onDelete: "set null",
        }),
        targetUserId: text("target_user_id").references(() => user.id, {
            onDelete: "set null",
        }),
        commentId: text("comment_id").references(() => workComment.id, {
            onDelete: "cascade",
        }),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
    },
    (table) => [
        index("activity_userId_createdAt_idx").on(
            table.userId,
            table.createdAt,
        ),
        index("activity_actorId_idx").on(table.actorId),
    ],
);

export const activityRelations = relations(activity, ({ one }) => ({
    user: one(user, { fields: [activity.userId], references: [user.id] }),
    actor: one(user, { fields: [activity.actorId], references: [user.id] }),
    work: one(work, { fields: [activity.workId], references: [work.id] }),
    targetUser: one(user, {
        fields: [activity.targetUserId],
        references: [user.id],
    }),
    comment: one(workComment, {
        fields: [activity.commentId],
        references: [workComment.id],
    }),
}));
