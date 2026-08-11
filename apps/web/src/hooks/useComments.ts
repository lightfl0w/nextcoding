import useSWR from "swr";
import type { Comment } from "~/lib/api";
import { fetchComments, workCommentsPath } from "~/lib/api";

/**
 * 作品评论列表。
 * @param workId - 作品 ID。
 */
export function useComments(workId: string) {
    return useSWR<Comment[]>(workCommentsPath(workId), fetchComments);
}
