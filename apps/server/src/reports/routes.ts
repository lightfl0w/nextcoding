import { Hono } from "hono";
import { type AuthenticatedEnv, requireSession } from "../http/guards.js";
import { jsonError, readJsonBody, readTrimmed } from "../http/responses.js";
import {
    findReportableWork,
    findReportByReporterAndWork,
    insertReport,
    REPORT_REASON_MAX_LENGTH,
    reopenReport,
} from "./repository.js";

export const reportRoutes = new Hono<AuthenticatedEnv>().post(
    "/:id/report",
    requireSession,
    async (c) => {
        const workId = c.req.param("id");
        const reporterId = c.get("userId");

        if (!(await findReportableWork(workId))) {
            return jsonError(c, "作品不存在", 404);
        }

        const body = await readJsonBody(c);
        const reason = readTrimmed(body, "reason").slice(
            0,
            REPORT_REASON_MAX_LENGTH,
        );
        if (!reason) {
            return jsonError(c, "请填写举报原因", 400);
        }

        const existing = await findReportByReporterAndWork(reporterId, workId);
        if (existing) {
            await reopenReport(existing.id, reason);
            return c.json({ ok: true, id: existing.id, reReported: true });
        }

        const id = await insertReport(reporterId, workId, reason);
        return c.json({ ok: true, id, reReported: false }, 201);
    },
);
