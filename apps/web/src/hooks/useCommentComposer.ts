import { toast } from "@heroui/react";
import { useCallback, useState } from "react";
import { postComment } from "~/lib/api";

export const COMMENT_MAX_LENGTH = 500;

/**
 * 评论输入与提交。
 * @param workId - 作品 ID。
 * @param reload - 提交成功后的刷新回调。
 * @remarks 仅用于发表顶级评论；回复评论由各线程内联输入框处理。
 */
export function useCommentComposer(
    workId: string,
    reload: () => Promise<unknown>,
) {
    const [draft, setDraft] = useState("");
    const [isPosting, setIsPosting] = useState(false);

    const submit = useCallback(async () => {
        const content = draft.trim();
        if (!content || isPosting) {
            return;
        }

        setIsPosting(true);
        try {
            await postComment(workId, content, null);
            setDraft("");
            await reload();
        } catch (error) {
            toast.danger((error as Error).message);
        } finally {
            setIsPosting(false);
        }
    }, [workId, draft, isPosting, reload]);

    return {
        draft,
        setDraft,
        isPosting,
        submit,
    };
}
