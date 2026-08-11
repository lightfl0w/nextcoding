import { authClient } from "@nextcoding/auth/client";

/**
 * better-auth 会话封装。
 * @returns 未登录时 `user` 为 `null`。
 */
export function useAuth() {
    const { data: session, isPending, refetch } = authClient.useSession();
    return {
        user: session?.user ?? null,
        isPending,
        isLoggedIn: !!session?.user,
        refetch,
    };
}
