import { toast } from "@heroui/react";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import { useAuth } from "~/hooks/useAuth";
import { applyWorkTemplate, myWorksKey } from "~/lib/api";
import type { WorkDetail } from "~/lib/api/types";

/**
 * 一键使用模板创作（游客视角）。
 * @param work - 开放为模板的作品详情。
 * @returns 是否可用与创作处理函数。
 */
export function useWorkTemplateCreator(work: WorkDetail | undefined) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { mutate } = useSWRConfig();
    const [pending, setPending] = useState(false);

    const handleUse = useCallback(async () => {
        if (!work?.isTemplate) {
            return;
        }
        if (!user) {
            navigate({
                to: "/auth",
                search: { mode: "login", redirect: `/work/${work.id}` },
            });
            return;
        }
        setPending(true);
        try {
            const result = await applyWorkTemplate(work.id);
            await mutate(myWorksKey(user.id));
            toast.success("已基于模板创建草稿，开始创作吧");
            navigate({ to: "/work/$id/edit", params: { id: result.id } });
        } catch (error) {
            toast.danger((error as Error).message);
        } finally {
            setPending(false);
        }
    }, [work, user, navigate, mutate]);

    return {
        canUse: !!work?.isTemplate,
        pending,
        handleUse,
    };
}
