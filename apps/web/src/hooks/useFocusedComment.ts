import { useEffect, useState } from "react";

/**
 * 评论定位。
 * @param commentId - 搜索参数里的评论 ID。
 * @param ready - 评论列表是否就绪。
 * @returns 当前聚焦的评论 ID 与设置器。
 * @remarks 评论加载完成后滚动到对应评论，2.5s 后清除聚焦。
 */
export function useFocusedComment(
    commentId: string | undefined,
    ready: boolean,
) {
    const [focusedCommentId, setFocusedCommentId] = useState<string | null>(
        commentId ?? null,
    );

    useEffect(() => {
        setFocusedCommentId(commentId ?? null);
    }, [commentId]);

    useEffect(() => {
        if (!ready || !focusedCommentId) {
            return;
        }
        const el = document.getElementById(`comment-${focusedCommentId}`);
        if (!el) {
            return;
        }
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        const timer = setTimeout(() => setFocusedCommentId(null), 2500);
        return () => clearTimeout(timer);
    }, [ready, focusedCommentId]);

    return { focusedCommentId, setFocusedCommentId };
}
