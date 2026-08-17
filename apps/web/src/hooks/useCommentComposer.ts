import { toast } from "@heroui/react";
import { useCallback, useState } from "react";
import { postComment } from "~/lib/api";

export const COMMENT_MAX_LENGTH = 500;

/**
 * 评论输入与提交。
 * @param workId - 作品 ID。
 * @param reload - 提交成功后的刷新回调。
 * @param parentId - 回复目标评论 ID；`null` 表示发表顶级评论。
 * @returns `submit` 返回是否发布成功。
 */
export function useCommentComposer(
    workId: string,
    reload: () => Promise<unknown>,
    parentId: string | null = null,
) {
    const [draft, setDraft] = useState("");
    const [isPosting, setIsPosting] = useState(false);

    const submit = useCallback(async () => {
        const content = draft.trim();
        if (!content || isPosting) {
            return false;
        }

        setIsPosting(true);
        try {
            await postComment(workId, content, parentId);
            setDraft("");
            await reload();
            return true;
        } catch (error) {
            toast.danger((error as Error).message);
            return false;
        } finally {
            setIsPosting(false);
        }
    }, [workId, draft, isPosting, parentId, reload]);

    return {
        draft,
        setDraft,
        isPosting,
        submit,
    };
}
