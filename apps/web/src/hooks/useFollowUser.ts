import { toast } from "@heroui/react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import { useAuth } from "~/hooks/useAuth";
import {
    FOLLOW_ALREADY_MESSAGE,
    FOLLOW_SELF_MESSAGE,
    FOLLOW_SUCCESS_MESSAGE,
    UNFOLLOW_SUCCESS_MESSAGE,
} from "~/hooks/useFollowAuthor";
import type { UserProfile } from "~/lib/api";
import { followUser, unfollowUser, userPath } from "~/lib/api";
import { HttpError } from "~/lib/api/http";

/**
 * 关注/取消关注用户主页的目标用户。
 * @param profile - 公开用户资料（加载中可能为 `undefined`）。
 * @returns 是否自己、请求中状态与切换函数。
 * @remarks 成功后乐观更新 `userPath` 缓存里的 `followers` 与 `isFollowedByMe`。
 */
export function useFollowUser(profile: UserProfile | undefined) {
    const { user, isLoggedIn } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { mutate } = useSWRConfig();
    const [pending, setPending] = useState(false);

    const targetId = profile?.id ?? null;
    const isSelf = !!user && !!profile && user.id === profile.id;

    const toggleFollow = useCallback(async () => {
        if (!profile || !targetId) {
            return;
        }
        if (!isLoggedIn) {
            navigate({
                to: "/auth",
                search: { mode: "login", redirect: location.pathname },
            });
            return;
        }
        if (isSelf) {
            toast.warning(FOLLOW_SELF_MESSAGE);
            return;
        }

        setPending(true);
        try {
            const wasFollowing = profile.isFollowedByMe;
            if (wasFollowing) {
                await unfollowUser(targetId);
            } else {
                await followUser(targetId);
            }
            toast.success(
                wasFollowing
                    ? UNFOLLOW_SUCCESS_MESSAGE
                    : FOLLOW_SUCCESS_MESSAGE,
            );
            mutate(
                userPath(targetId),
                (current: UserProfile | undefined) => {
                    if (!current) {
                        return current;
                    }
                    return {
                        ...current,
                        isFollowedByMe: !wasFollowing,
                        followers: current.followers + (wasFollowing ? -1 : 1),
                    };
                },
                false,
            );
        } catch (error) {
            if (error instanceof HttpError && error.status === 409) {
                toast.warning(FOLLOW_ALREADY_MESSAGE);
            } else {
                toast.danger((error as Error).message);
            }
        } finally {
            setPending(false);
        }
    }, [
        profile,
        targetId,
        isLoggedIn,
        isSelf,
        navigate,
        location.pathname,
        mutate,
    ]);

    return { isSelf, pending, toggleFollow };
}
