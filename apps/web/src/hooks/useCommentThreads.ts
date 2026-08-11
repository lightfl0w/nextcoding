import { useMemo } from "react";
import type { Comment } from "~/lib/api";

export interface CommentThread {
    root: Comment;
    replies: Comment[];
}

export function useCommentThreads(comments: Comment[] | undefined) {
    return useMemo(() => buildThreads(comments ?? []), [comments]);
}

function buildThreads(comments: Comment[]): CommentThread[] {
    const threads: CommentThread[] = [];
    const threadByRootId = new Map<string, CommentThread>();

    for (const comment of comments) {
        if (comment.parentId) continue;
        const thread: CommentThread = { root: comment, replies: [] };
        threads.push(thread);
        threadByRootId.set(comment.id, thread);
    }

    for (const comment of comments) {
        if (!comment.parentId) continue;
        threadByRootId.get(comment.parentId)?.replies.push(comment);
    }

    return threads;
}
