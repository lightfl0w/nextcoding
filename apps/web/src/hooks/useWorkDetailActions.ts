import { toast } from "@heroui/react";
import type { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import type { useSWRConfig } from "swr";
import { SPARK_ALREADY_SENT } from "~/hooks/useGiveSpark";
import { myWorksKey, remixWork, workPath, workRemixesPath } from "~/lib/api";

type Navigate = ReturnType<typeof useNavigate>;
type GlobalMutate = ReturnType<typeof useSWRConfig>["mutate"];

interface WorkDetailActionsOptions {
    isLoggedIn: boolean;
    workId: string;
    user: { id: string } | null;
    spark: { sparked: boolean; give: () => Promise<boolean> };
    mutate: GlobalMutate;
    navigate: Navigate;
}

/**
 * 未登录时跳转登录页。
 * @param isLoggedIn - 是否已登录。
 * @param navigate - 跳转函数。
 * @param workId - 作品 ID。
 * @returns 已登录返回 `true`，否则跳转后返回 `false`。
 */
function requireLogin(
    isLoggedIn: boolean,
    navigate: Navigate,
    workId: string,
): boolean {
    if (isLoggedIn) {
        return true;
    }
    navigate({
        to: "/auth",
        search: { mode: "login", redirect: `/work/${workId}` },
    });
    return false;
}

/**
 * 详情页互动操作。
 * @param options.isLoggedIn - 是否已登录。
 * @param options.workId - 作品 ID。
 * @param options.user - 当前用户。
 * @param options.spark - 火花状态与送出函数。
 * @param options.mutate - 全局缓存更新。
 * @param options.navigate - 跳转函数。
 * @returns 送火花与二创的处理函数。
 */
export function useWorkDetailActions({
    isLoggedIn,
    workId,
    user,
    spark,
    mutate,
    navigate,
}: WorkDetailActionsOptions) {
    const handleSpark = useCallback(async () => {
        if (!requireLogin(isLoggedIn, navigate, workId)) {
            return;
        }
        if (spark.sparked) {
            toast.warning(SPARK_ALREADY_SENT);
            return;
        }
        const ok = await spark.give();
        if (ok) {
            mutate(
                workPath(workId),
                (current) =>
                    current
                        ? { ...current, sparks: current.sparks + 1 }
                        : current,
                false,
            );
        }
    }, [isLoggedIn, navigate, spark.give, spark.sparked, workId, mutate]);

    const handleRemix = useCallback(async () => {
        if (!requireLogin(isLoggedIn, navigate, workId)) {
            return;
        }
        try {
            const fork = await remixWork(workId);
            await Promise.all([
                mutate(workRemixesPath(workId)),
                user ? mutate(myWorksKey(user.id)) : Promise.resolve(),
            ]);
            toast.success("二创成功，开始你的创作吧");
            navigate({ to: "/work/$id/edit", params: { id: fork.id } });
        } catch (error) {
            toast.danger((error as Error).message);
        }
    }, [isLoggedIn, navigate, workId, mutate, user]);

    return { handleSpark, handleRemix };
}
