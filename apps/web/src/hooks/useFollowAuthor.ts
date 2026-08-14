import { useCallback } from "react";
import { useSWRConfig } from "swr";
import { useAuth } from "~/hooks/useAuth";
import { useFollowToggle } from "~/hooks/useFollowToggle";
import type { WorkDetail } from "~/lib/api";
import { workPath } from "~/lib/api";

/**
 * 关注/取消关注作者。
 * @param work - 作品详情（加载中可能为 `undefined`）。
 * @returns 是否自己、请求中状态与切换函数。
 * @remarks 成功后乐观更新 `workPath` 缓存里的 `author.followers` 与 `followedByMe`。
 */
export function useFollowAuthor(work: WorkDetail | undefined) {
    const { user } = useAuth();
    const { mutate } = useSWRConfig();

    const authorId = work?.author.id ?? null;
    const isSelf = !!user && !!work && user.id === work.userId;
    const following = work?.author.followedByMe ?? false;

    const applyFollowState = useCallback(
        (id: string, next: boolean) => {
            mutate(
                workPath(id),
                (current: WorkDetail | undefined) => {
                    if (!current) {
                        return current;
                    }
                    return {
                        ...current,
                        author: {
                            ...current.author,
                            followedByMe: next,
                            followers:
                                (current.author.followers ?? 0) +
                                (next ? 1 : -1),
                        },
                    };
                },
                false,
            );
        },
        [mutate],
    );

    const follow = useFollowToggle({
        targetId: authorId,
        isSelf,
        following,
        onChanged: useCallback(
            (next: boolean) => {
                if (authorId) {
                    applyFollowState(authorId, next);
                }
            },
            [authorId, applyFollowState],
        ),
    });

    return { isSelf, ...follow };
}
