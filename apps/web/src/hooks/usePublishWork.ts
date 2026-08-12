import { toast } from "@heroui/react";
import type { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import type { useSWRConfig } from "swr";
import type { WorkFile } from "~/lib/api";
import { publishWork, workPath } from "~/lib/api";

type Navigate = ReturnType<typeof useNavigate>;
type GlobalMutate = ReturnType<typeof useSWRConfig>["mutate"];

interface PublishWorkOptions {
    workId: string;
    files: WorkFile[];
    readDraft: (key: string) => string | null;
    mutate: GlobalMutate;
    navigate: Navigate;
}

/**
 * 读取文件内容长度。
 * @param file - 文件。
 * @param readDraft - 读取草稿内容。
 * @returns 有草稿用草稿长度，否则回退到服务器记录的大小。
 */
function contentLength(
    file: WorkFile,
    readDraft: (key: string) => string | null,
): number {
    const draft = readDraft(file.key);
    return draft === null ? file.size : draft.length;
}

/**
 * 发布作品。
 * @param options.workId - 作品 ID。
 * @param options.files - 作品文件。
 * @param options.readDraft - 读取草稿内容。
 * @param options.mutate - 全局缓存更新。
 * @param options.navigate - 跳转函数。
 * @returns 发布处理函数。
 * @remarks 无文件或全空时提示并中断，发布成功后跳转详情页。
 */
export function usePublishWork({
    workId,
    files,
    readDraft,
    mutate,
    navigate,
}: PublishWorkOptions) {
    const publishWorkAction = useCallback(async () => {
        if (files.length === 0) {
            toast.warning("发布前请先创建文件");
            return;
        }
        const hasContent = files.some(
            (file) => contentLength(file, readDraft) > 0,
        );
        if (!hasContent) {
            toast.warning("请至少在一个文件里填写内容后再发布");
            return;
        }
        try {
            await publishWork(workId);
            await mutate(workPath(workId));
            toast.success("作品已发布");
            navigate({ to: "/work/$id", params: { id: workId } });
        } catch (error) {
            toast.danger((error as Error).message);
        }
    }, [workId, navigate, files, readDraft, mutate]);

    return { publishWorkAction };
}
