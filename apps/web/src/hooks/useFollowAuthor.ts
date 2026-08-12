import { toast } from "@heroui/react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import { useAuth } from "~/hooks/useAuth";
import type { WorkDetail } from "~/lib/api";
import { followUser, unfollowUser, workPath } from "~/lib/api";
import { HttpError } from "~/lib/api/http";

export const FOLLOW_SELF_MESSAGE = "不能关注自己";
export const FOLLOW_SUCCESS_MESSAGE = "关注成功";
export const UNFOLLOW_SUCCESS_MESSAGE = "已取消关注";
export const FOLLOW_ALREADY_MESSAGE = "已经关注过了";

/**
 * 关注/取消关注作者。
 * @param work - 作品详情（加载中可能为 `undefined`）。
 * @returns 是否自己、请求中状态与切换函数。
 * @remarks 成功后乐观更新 `workPath` 缓存里的 `author.followers` 与 `followedByMe`。
 */
export function useFollowAuthor(work: WorkDetail | undefined) {
    const { user, isLoggedIn } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { mutate } = useSWRConfig();
    const [pending, setPending] = useState(false);

    const authorId = work?.author.id ?? null;
    const isSelf = !!user && !!work && user.id === work.userId;

    const toggleFollow = useCallback(async () => {
        if (!work || !authorId) {
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
            const wasFollowing = work.author.followedByMe ?? false;
            if (wasFollowing) {
                await unfollowUser(authorId);
            } else {
                await followUser(authorId);
            }
            toast.success(
                wasFollowing
                    ? UNFOLLOW_SUCCESS_MESSAGE
                    : FOLLOW_SUCCESS_MESSAGE,
            );
            mutate(
                workPath(work.id),
                (current) => {
                    if (!current) {
                        return current;
                    }
                    return {
                        ...current,
                        author: {
                            ...current.author,
                            followedByMe: !wasFollowing,
                            followers:
                                (current.author.followers ?? 0) +
                                (wasFollowing ? -1 : 1),
                        },
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
        work,
        authorId,
        isLoggedIn,
        isSelf,
        navigate,
        location.pathname,
        mutate,
    ]);

    return { isSelf, pending, toggleFollow };
}
