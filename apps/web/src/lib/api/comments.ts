import { getJson, mutateJson } from "./http";
import type { Comment } from "./types";

/**
 * 评论列表路径。
 * @param workId - 作品 ID。
 */
export function workCommentsPath(workId: string): string {
    return `/api/works/${workId}/comments`;
}

/**
 * 获取评论列表。
 * @param path - 评论路径。
 */
export function fetchComments(path: string): Promise<Comment[]> {
    return getJson<Comment[]>(path);
}

/**
 * 发表评论。
 * @param workId - 作品 ID。
 * @param content - 评论内容。
 * @param parentId - 父评论 ID；顶级评论传 `null`。
 */
export function postComment(
    workId: string,
    content: string,
    parentId: string | null,
): Promise<Comment> {
    return mutateJson<Comment>(workCommentsPath(workId), "POST", {
        content,
        parentId,
    });
}
