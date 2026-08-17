import { db, report, work } from "@nextcoding/db";
import { and, eq } from "drizzle-orm";

export const REPORT_REASON_MAX_LENGTH = 200;

/**
 * 判断作品是否可被举报（必须已发布）。
 */
export function findReportableWork(workId: string) {
    return db
        .select({ id: work.id })
        .from(work)
        .where(and(eq(work.id, workId), eq(work.status, "published")))
        .get();
}

/**
 * 查找同一用户对同一作品的既有举报，用于去重与重开。
 */
export function findReportByReporterAndWork(
    reporterId: string,
    workId: string,
) {
    return db
        .select({ id: report.id, status: report.status })
        .from(report)
        .where(
            and(eq(report.reporterId, reporterId), eq(report.workId, workId)),
        )
        .get();
}

export async function insertReport(
    reporterId: string,
    workId: string,
    reason: string,
) {
    const id = crypto.randomUUID();
    await db.insert(report).values({
        id,
        workId,
        reporterId,
        reason,
        status: "pending",
    });
    return id;
}

/**
 * 重开既有举报：更新原因并重置为待处理。
 */
export async function reopenReport(id: string, reason: string) {
    await db
        .update(report)
        .set({
            reason,
            status: "pending",
            handledBy: null,
            handledAt: null,
        })
        .where(eq(report.id, id));
}
