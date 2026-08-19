import useSWR from "swr";
import type { Comment, CommentSort } from "~/lib/api";
import { fetchComments, workCommentsPath } from "~/lib/api";

/**
 * 作品评论列表。
 * @param workId - 作品 ID。
 * @param sort - 排序方式：时间或受欢迎度。
 */
export function useComments(workId: string, sort: CommentSort = "time") {
    const key = `${workCommentsPath(workId)}?sort=${sort}`;
    return useSWR<Comment[]>(key, fetchComments);
}
