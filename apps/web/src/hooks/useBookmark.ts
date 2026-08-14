import { toast } from "@heroui/react";
import { useCallback, useState } from "react";
import useSWR from "swr";
import {
    type BookmarkStatus,
    bookmarkPath,
    fetchBookmarkStatus,
    toggleBookmark,
} from "~/lib/api/bookmarks";
import { useAuth } from "./useAuth";

export function useBookmark(workId: string) {
    const { isLoggedIn } = useAuth();
    const [pending, setPending] = useState(false);

    const { data, mutate } = useSWR<BookmarkStatus>(
        isLoggedIn ? bookmarkPath(workId) : null,
        fetchBookmarkStatus,
    );

    const toggle = useCallback(async () => {
        if (!isLoggedIn) {
            toast.warning("请先登录");
            return;
        }
        if (pending) {
            return;
        }
        setPending(true);
        try {
            const wasBookmarked = data?.bookmarked ?? false;
            await mutate(
                async () => {
                    await toggleBookmark(workId, wasBookmarked);
                    return { bookmarked: !wasBookmarked };
                },
                {
                    optimisticData: { bookmarked: !wasBookmarked },
                    revalidate: false,
                },
            );
            toast.success(wasBookmarked ? "已取消收藏" : "已收藏");
        } catch {
            toast.danger("操作失败");
            await mutate();
        } finally {
            setPending(false);
        }
    }, [isLoggedIn, pending, data?.bookmarked, workId, mutate]);

    return {
        bookmarked: data?.bookmarked ?? false,
        pending,
        toggle,
    };
}
