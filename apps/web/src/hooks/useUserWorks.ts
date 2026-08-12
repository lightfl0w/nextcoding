import useSWR from "swr";
import type { Work } from "~/lib/api";
import { fetchUserWorks, userWorksPath } from "~/lib/api";

const USER_WORKS_PAGE_SIZE = 50;

/**
 * 某用户已发布的作品列表。
 * @param userId - 目标用户 ID。
 */
export function useUserWorks(userId: string) {
    return useSWR<Work[]>(userWorksPath(userId, USER_WORKS_PAGE_SIZE), () =>
        fetchUserWorks(userId, USER_WORKS_PAGE_SIZE),
    );
}
