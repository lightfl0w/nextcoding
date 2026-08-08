import { authClient } from "@nextcoding/auth/client";

export function useAuth() {
    const { data: session, isPending } = authClient.useSession();
    return {
        user: session?.user ?? null,
        isPending,
        isLoggedIn: !!session?.user,
    };
}
