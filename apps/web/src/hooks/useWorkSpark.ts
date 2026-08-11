import { useCallback } from "react";
import useSWR from "swr";
import { useAuth } from "~/hooks/useAuth";
import { useGiveSpark } from "~/hooks/useGiveSpark";
import { fetchWorkSpark, workSparkPath } from "~/lib/api";

/**
 * 详情页火花状态。
 * @param workId - 作品 ID。
 * @remarks 送出成功后本地置位，不重新拉取。
 */
export function useWorkSpark(workId: string) {
    const { isLoggedIn } = useAuth();
    const giveSpark = useGiveSpark();

    const { data, mutate } = useSWR(
        isLoggedIn ? workSparkPath(workId) : null,
        () => fetchWorkSpark(workId),
    );

    const give = useCallback(async (): Promise<boolean> => {
        const ok = await giveSpark(workId);
        if (ok) {
            mutate({ sparked: true }, false);
        }
        return ok;
    }, [workId, giveSpark, mutate]);

    return {
        sparked: data?.sparked ?? false,
        give,
    };
}
