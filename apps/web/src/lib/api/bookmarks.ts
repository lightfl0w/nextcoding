import { getJson, mutateJson } from "./http";
import type { Work } from "./types";

export interface BookmarkStatus {
    bookmarked: boolean;
}

export function bookmarkPath(workId: string) {
    return `/api/works/${workId}/bookmark`;
}

export function userBookmarksPath(userId: string, limit?: number) {
    return `/api/users/${userId}/bookmarks${limit ? `?limit=${limit}` : ""}`;
}

export async function fetchBookmarkStatus(
    path: string,
): Promise<BookmarkStatus> {
    return getJson<BookmarkStatus>(path);
}

export async function toggleBookmark(
    workId: string,
    bookmarked: boolean,
): Promise<void> {
    await mutateJson(bookmarkPath(workId), bookmarked ? "DELETE" : "POST");
}

export async function fetchUserBookmarks(path: string): Promise<Work[]> {
    return getJson<Work[]>(path);
}
