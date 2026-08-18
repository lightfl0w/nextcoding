import { toast } from "@heroui/react";
import { useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import { disableWorkTemplate, enableWorkTemplate } from "~/lib/api/templates";
import type { WorkDetail } from "~/lib/api/types";
import { workPath } from "~/lib/api/works";

/**
 * 作品模板开关（作者视角）。
 * @param work - 作品详情。
 * @returns 模板状态、被使用次数与开启/关闭操作。
 */
export function useWorkTemplate(work: WorkDetail | undefined) {
    const { mutate } = useSWRConfig();
    const [pending, setPending] = useState(false);

    const handleEnable = useCallback(
        async (meta?: {
            title?: string;
            description?: string;
            category?: string;
            coverUrl?: string;
        }) => {
            if (!work) {
                return;
            }
            setPending(true);
            try {
                await enableWorkTemplate(work.id, meta);
                await mutate(workPath(work.id));
                toast.success("已开放为模板，快去模板市场看看吧");
            } catch (error) {
                toast.danger((error as Error).message);
            } finally {
                setPending(false);
            }
        },
        [work, mutate],
    );

    const handleDisable = useCallback(async () => {
        if (!work) {
            return;
        }
        setPending(true);
        try {
            await disableWorkTemplate(work.id);
            await mutate(workPath(work.id));
            toast.success("已关闭模板状态");
        } catch (error) {
            toast.danger((error as Error).message);
        } finally {
            setPending(false);
        }
    }, [work, mutate]);

    return {
        isTemplate: work?.isTemplate ?? false,
        useCount: work?.templateUseCount ?? 0,
        pending,
        handleEnable,
        handleDisable,
    };
}
