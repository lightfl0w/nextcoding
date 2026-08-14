import { relations, sql } from "drizzle-orm";
import {
    index,
    integer,
    sqliteTable,
    text,
    uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth.js";

export const achievement = sqliteTable(
    "achievement",
    {
        id: text("id").primaryKey(),
        key: text("key").notNull(),
        name: text("name").notNull(),
        description: text("description").notNull(),
        icon: text("icon").notNull(),
        category: text("category"),
        threshold: integer("threshold"),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
    },
    (table) => [uniqueIndex("achievement_key_unique").on(table.key)],
);

export const userAchievement = sqliteTable(
    "user_achievement",
    {
        id: text("id").primaryKey(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        achievementId: text("achievement_id")
            .notNull()
            .references(() => achievement.id, { onDelete: "cascade" }),
        unlockedAt: integer("unlocked_at", { mode: "timestamp_ms" }).notNull(),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
    },
    (table) => [
        uniqueIndex("user_achievement_unique").on(
            table.userId,
            table.achievementId,
        ),
        index("user_achievement_userId_idx").on(table.userId),
    ],
);

export const achievementRelations = relations(achievement, ({ many }) => ({
    users: many(userAchievement),
}));

export const userAchievementRelations = relations(
    userAchievement,
    ({ one }) => ({
        user: one(user, {
            fields: [userAchievement.userId],
            references: [user.id],
        }),
        achievement: one(achievement, {
            fields: [userAchievement.achievementId],
            references: [achievement.id],
        }),
    }),
);
