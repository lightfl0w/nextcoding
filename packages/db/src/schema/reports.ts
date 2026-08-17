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

export const report = sqliteTable(
    "report",
    {
        id: text("id").primaryKey(),
        workId: text("work_id")
            .notNull()
            .references(() => work.id, { onDelete: "cascade" }),
        reporterId: text("reporter_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        reason: text("reason").notNull(),
        status: text("status", {
            enum: ["pending", "resolved", "dismissed"],
        })
            .default("pending")
            .notNull(),
        handledBy: text("handled_by").references(() => user.id, {
            onDelete: "set null",
        }),
        handledAt: integer("handled_at", { mode: "timestamp_ms" }),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
    },
    (table) => [
        uniqueIndex("report_reporter_work_unique").on(
            table.reporterId,
            table.workId,
        ),
        index("report_status_createdAt_idx").on(table.status, table.createdAt),
        index("report_workId_idx").on(table.workId),
    ],
);

export const reportRelations = relations(report, ({ one }) => ({
    work: one(work, { fields: [report.workId], references: [work.id] }),
    reporter: one(user, {
        fields: [report.reporterId],
        references: [user.id],
    }),
    handler: one(user, { fields: [report.handledBy], references: [user.id] }),
}));
