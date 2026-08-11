import { useMemo } from "react";
import type { Comment } from "~/lib/api";

export interface CommentThread {
    root: Comment;
    replies: Comment[];
}

/**
 * 组装评论线程。
 * @param comments - 平铺的评论列表。
 * @returns 按 parentId 组装成的「根评论 + 回复」线程。
 */
export function useCommentThreads(comments: Comment[] | undefined) {
    return useMemo(() => buildThreads(comments ?? []), [comments]);
}

function buildThreads(comments: Comment[]): CommentThread[] {
    const threads: CommentThread[] = [];
    const threadByRootId = new Map<string, CommentThread>();

    for (const comment of comments) {
        if (comment.parentId) {
            continue;
        }
        const thread: CommentThread = { root: comment, replies: [] };
        threads.push(thread);
        threadByRootId.set(comment.id, thread);
    }

    for (const comment of comments) {
        if (!comment.parentId) {
            continue;
        }
        threadByRootId.get(comment.parentId)?.replies.push(comment);
    }

    return threads;
}
