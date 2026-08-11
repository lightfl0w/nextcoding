import { getJson, mutateJson } from "./http";
import type { Comment } from "./types";

export function workCommentsPath(workId: string): string {
    return `/api/works/${workId}/comments`;
}

export function fetchComments(path: string): Promise<Comment[]> {
    return getJson<Comment[]>(path);
}

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
