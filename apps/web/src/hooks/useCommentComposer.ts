import { toast } from "@heroui/react";
import { useCallback, useState } from "react";
import { postComment } from "~/lib/api";

export const COMMENT_MAX_LENGTH = 500;

export interface ReplyTarget {
    rootId: string;
    name: string;
}

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
        if (!content || isPosting) return;

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
