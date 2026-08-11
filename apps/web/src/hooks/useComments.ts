import useSWR from "swr";
import type { Comment } from "~/lib/api";
import { fetchComments, workCommentsPath } from "~/lib/api";

export function useComments(workId: string) {
    return useSWR<Comment[]>(workCommentsPath(workId), fetchComments);
}
