import { useCallback } from "react";
import { useSWRConfig } from "swr";
import { useAuth } from "~/hooks/useAuth";
import { useFollowToggle } from "~/hooks/useFollowToggle";
import type { UserProfile } from "~/lib/api";
import { userPath } from "~/lib/api";

/**
 * 关注/取消关注用户主页的目标用户。
 * @param profile - 公开用户资料（加载中可能为 `undefined`）。
 * @returns 是否自己、请求中状态与切换函数。
 * @remarks 成功后乐观更新 `userPath` 缓存里的 `followers` 与 `isFollowedByMe`。
 */
export function useFollowUser(profile: UserProfile | undefined) {
    const { user } = useAuth();
    const { mutate } = useSWRConfig();

    const targetId = profile?.id ?? null;
    const isSelf = !!user && !!profile && user.id === profile.id;
    const following = profile?.isFollowedByMe ?? false;

    const applyFollowState = useCallback(
        (id: string, next: boolean) => {
            mutate(
                userPath(id),
                (current: UserProfile | undefined) => {
                    if (!current) {
                        return current;
                    }
                    return {
                        ...current,
                        isFollowedByMe: next,
                        followers: current.followers + (next ? 1 : -1),
                    };
                },
                false,
            );
        },
        [mutate],
    );

    const follow = useFollowToggle({
        targetId,
        isSelf,
        following,
        onChanged: useCallback(
            (next: boolean) => {
                if (targetId) {
                    applyFollowState(targetId, next);
                }
            },
            [targetId, applyFollowState],
        ),
    });

    return { isSelf, ...follow };
}
