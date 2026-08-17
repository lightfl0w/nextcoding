import { mutateJson } from "./http";

export interface ReportResult {
    ok: boolean;
    id: string;
    reReported: boolean;
}

/**
 * 举报作品。
 * @param workId - 作品 ID。
 * @param reason - 举报原因。
 * @throws 未登录（401）、作品不存在（404）或未填原因（400）时抛 {@link HttpError}。
 */
export function reportWork(
    workId: string,
    reason: string,
): Promise<ReportResult> {
    return mutateJson<ReportResult>(
        `/api/works/${workId}/report`,
        "POST",
        { reason },
        "举报提交失败",
    );
}
