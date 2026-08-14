import { useMemo } from "react";
import type { Comment } from "~/lib/api";

export interface CommentNode {
    comment: Comment;
    children: CommentNode[];
}

export interface CommentThread {
    root: Comment;
    children: CommentNode[];
}

/**
 * 组装楼中楼评论树。
 * @param comments - 平铺的评论列表。
 * @returns 按 parentId 组装成的「根评论 + 任意层级回复」线程。
 */
export function useCommentThreads(comments: Comment[] | undefined) {
    return useMemo(() => buildThreads(comments ?? []), [comments]);
}

function buildThreads(comments: Comment[]): CommentThread[] {
    const nodeById = new Map<string, CommentNode>();
    const roots: Comment[] = [];

    for (const comment of comments) {
        nodeById.set(comment.id, { comment, children: [] });
        if (!comment.parentId) {
            roots.push(comment);
        }
    }

    for (const comment of comments) {
        if (!comment.parentId) {
            continue;
        }
        const node = nodeById.get(comment.id);
        if (!node) {
            continue;
        }
        const parent = nodeById.get(comment.parentId);
        if (parent) {
            parent.children.push(node);
        } else {
            roots.push(comment);
        }
    }

    return roots.map((root) => ({
        root,
        children: nodeById.get(root.id)?.children ?? [],
    }));
}
