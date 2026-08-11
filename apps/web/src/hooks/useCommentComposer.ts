import { toast } from "@heroui/react";
import { useCallback, useState } from "react";
import { postComment } from "~/lib/api";

export const COMMENT_MAX_LENGTH = 500;

export interface ReplyTarget {
    rootId: string;
    name: string;
}

/**
 * 评论/回复输入与提交。
 * @param workId - 作品 ID。
 * @param reload - 提交成功后的刷新回调。
 * @remarks 成功后清空草稿并触发 reload。
 */
export function useCommentComposer(
    workId: string,
    reload: () => Promise<unknown>,
) {
    const [draft, setDraft] = useState("");
    const [isPosting, setIsPosting] = useState(false);
    const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);

    const clearReplyTarget = useCallback(() => setReplyTarget(null), []);

    const submit = useCallback(async () => {
        const content = draft.trim();
        if (!content || isPosting) {
            return;
        }

        setIsPosting(true);
        try {
            await postComment(workId, content, replyTarget?.rootId ?? null);
            setDraft("");
            setReplyTarget(null);
            await reload();
        } catch (error) {
            toast.danger((error as Error).message);
        } finally {
            setIsPosting(false);
        }
    }, [workId, draft, isPosting, replyTarget, reload]);

    return {
        draft,
        setDraft,
        isPosting,
        replyTarget,
        setReplyTarget,
        clearReplyTarget,
        submit,
    };
}
