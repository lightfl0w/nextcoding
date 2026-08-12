import { toast } from "@heroui/react";
import { useCallback, useEffect, useState } from "react";
import type { KeyedMutator } from "swr";
import type { WorkDetail } from "~/lib/api";
import { updateWorkTitle } from "~/lib/api";

interface EditableTitleOptions {
    work: WorkDetail | undefined;
    workId: string;
    mutateWork: KeyedMutator<WorkDetail>;
}

/**
 * 可编辑作品标题。
 * @param options.work - 作品数据。
 * @param options.workId - 作品 ID。
 * @param options.mutateWork - 作品缓存更新。
 * @returns 标题状态与保存函数。
 * @remarks 服务端数据变化时同步标题，保存失败回滚到原标题。
 */
export function useEditableTitle({
    work,
    workId,
    mutateWork,
}: EditableTitleOptions) {
    const [title, setTitle] = useState("");

    useEffect(() => {
        if (work) {
            setTitle(work.title);
        }
    }, [work?.title, work]);

    const saveTitle = useCallback(async () => {
        const trimmed = title.trim();
        if (!work || !trimmed || trimmed === work.title) {
            return;
        }
        try {
            await updateWorkTitle(workId, trimmed);
            setTitle(trimmed);
            mutateWork(
                (current) =>
                    current ? { ...current, title: trimmed } : current,
                false,
            );
        } catch (error) {
            toast.danger((error as Error).message);
            setTitle(work.title);
        }
    }, [title, work, workId, mutateWork]);

    return { title, setTitle, saveTitle };
}
