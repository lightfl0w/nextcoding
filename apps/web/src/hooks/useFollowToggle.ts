import { toast } from "@heroui/react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useAuth } from "~/hooks/useAuth";
import { followUser, unfollowUser } from "~/lib/api";
import { HttpError } from "~/lib/api/http";

export const FOLLOW_SELF_MESSAGE = "不能关注自己";
export const FOLLOW_SUCCESS_MESSAGE = "关注成功";
export const UNFOLLOW_SUCCESS_MESSAGE = "已取消关注";
export const FOLLOW_ALREADY_MESSAGE = "已经关注过了";

function reportFollowError(error: unknown) {
    if (error instanceof HttpError && error.status === 409) {
        toast.warning(FOLLOW_ALREADY_MESSAGE);
    } else {
        toast.danger((error as Error).message);
    }
}

interface FollowToggleOptions {
    targetId: string | null;
    isSelf: boolean;
    following: boolean;
    onChanged: (following: boolean) => void;
}

/**
 * 关注/取消关注的公共逻辑。
 * @param options.targetId - 目标用户 ID；为空时不执行。
 * @param options.isSelf - 目标是否为当前用户。
 * @param options.following - 当前是否已关注。
 * @param options.onChanged - 切换成功后的回调（携带新状态）。
 * @returns 请求中状态与切换函数。
 * @remarks 未登录时跳转登录页；成功后由调用方通过 `onChanged` 乐观更新缓存。
 */
export function useFollowToggle({
    targetId,
    isSelf,
    following,
    onChanged,
}: FollowToggleOptions) {
    const { isLoggedIn } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [pending, setPending] = useState(false);

    const toggleFollow = useCallback(async () => {
        if (!targetId) {
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
            const request = following ? unfollowUser : followUser;
            await request(targetId);
            toast.success(
                following ? UNFOLLOW_SUCCESS_MESSAGE : FOLLOW_SUCCESS_MESSAGE,
            );
            onChanged(!following);
        } catch (error) {
            reportFollowError(error);
        } finally {
            setPending(false);
        }
    }, [
        targetId,
        isLoggedIn,
        navigate,
        location.pathname,
        isSelf,
        following,
        onChanged,
    ]);

    return { pending, toggleFollow };
}
