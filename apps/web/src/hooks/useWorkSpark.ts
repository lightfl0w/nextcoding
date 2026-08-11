import { useCallback } from "react";
import useSWR from "swr";
import { useAuth } from "~/hooks/useAuth";
import { useGiveSpark } from "~/hooks/useGiveSpark";
import { fetchWorkSpark, workSparkPath } from "~/lib/api";

export function useWorkSpark(workId: string) {
    const { isLoggedIn } = useAuth();
    const giveSpark = useGiveSpark();

    const { data, mutate } = useSWR(
        isLoggedIn ? workSparkPath(workId) : null,
        () => fetchWorkSpark(workId),
    );

    const give = useCallback(async (): Promise<boolean> => {
        const ok = await giveSpark(workId);
        if (ok) mutate({ sparked: true }, false);
        return ok;
    }, [workId, giveSpark, mutate]);

    return {
        sparked: data?.sparked ?? false,
        give,
    };
}
