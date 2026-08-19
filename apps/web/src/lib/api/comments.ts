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

/**
 * 删除作品评论（级联删除其回复）。
 * @param workId - 作品 ID。
 * @param commentId - 评论 ID。
 */
export function deleteWorkComment(workId: string, commentId: string) {
    return mutateJson<{ ok: true; id: string }>(
        `${workCommentsPath(workId)}/${commentId}`,
        "DELETE",
        undefined,
        "删除评论失败",
    );
}

/**
 * 置顶 / 取消置顶作品评论（仅作者可用）。
 * @param workId - 作品 ID。
 * @param commentId - 评论 ID。
 * @param pinned - 是否置顶。
 */
export function pinWorkComment(
    workId: string,
    commentId: string,
    pinned: boolean,
) {
    return mutateJson<{ ok: true; id: string; pinned: boolean }>(
        `${workCommentsPath(workId)}/${commentId}/pin`,
        "PATCH",
        { pinned },
        "操作失败",
    );
}

/**
 * 点赞 / 取消点赞作品评论。
 * @param workId - 作品 ID。
 * @param commentId - 评论 ID。
 */
export function likeWorkComment(workId: string, commentId: string) {
    return mutateJson<{
        ok: true;
        id: string;
        liked: boolean;
        likeCount: number;
    }>(
        `${workCommentsPath(workId)}/${commentId}/like`,
        "POST",
        undefined,
        "操作失败",
    );
}
