import { authClient } from "@nextcoding/auth/client";

/**
 * better-auth 会话封装。
 * @returns 未登录时 `user` 为 `null`。
 */
export function useAuth() {
    const { data: session, isPending, refetch } = authClient.useSession();
    const rawUser = session?.user ?? null;
    const user = rawUser
        ? {
              ...rawUser,
              role: (rawUser as { role?: string | null }).role ?? null,
          }
        : null;
    return {
        user,
        isPending,
        isLoggedIn: !!user,
        refetch,
    };
}
