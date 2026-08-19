import { toast } from "@heroui/react";
import { useCallback, useState } from "react";

export const COMMENT_MAX_LENGTH = 500;

/**
 * 评论提交函数：把内容发往对应主题（作品/模板）的评论接口。
 * @param content - 评论内容。
 * @param parentId - 父评论 ID；`null` 表示发表顶级评论。
 */
export type SubmitComment = (
    content: string,
    parentId: string | null,
) => Promise<unknown>;

/**
 * 评论输入与提交。
 * @param submitComment - 提交函数（作品或模板评论接口）。
 * @param reload - 提交成功后的刷新回调。
 * @param parentId - 回复目标评论 ID；`null` 表示发表顶级评论。
 * @returns `submit` 返回是否发布成功。
 */
export function useCommentComposer(
    submitComment: SubmitComment,
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
            await submitComment(content, parentId);
            setDraft("");
            await reload();
            return true;
        } catch (error) {
            toast.danger((error as Error).message);
            return false;
        } finally {
            setIsPosting(false);
        }
    }, [submitComment, draft, isPosting, parentId, reload]);

    return {
        draft,
        setDraft,
        isPosting,
        submit,
    };
}
