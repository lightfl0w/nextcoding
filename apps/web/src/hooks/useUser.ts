import useSWR from "swr";
import type { UserProfile } from "~/lib/api";
import { fetchUser, userPath } from "~/lib/api";

/**
 * 公开用户资料。
 * @param userId - 目标用户 ID。
 * @remarks SWR key 即 `userPath`，关注切换后按同一 key 乐观更新。
 */
export function useUser(userId: string) {
    return useSWR<UserProfile>(userPath(userId), () => fetchUser(userId));
}
