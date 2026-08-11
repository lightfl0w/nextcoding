const AUTH_MODES = ["login", "register", "forgot"] as const;

export type AuthMode = (typeof AUTH_MODES)[number];

interface AuthSearch {
    mode: AuthMode;
    redirect: string | undefined;
}

export function validateAuthSearch(
    search: Record<string, unknown>,
): AuthSearch {
    const mode = AUTH_MODES.includes(search.mode as AuthMode)
        ? (search.mode as AuthMode)
        : "login";
    return {
        mode,
        redirect: (search.redirect as string | undefined) ?? undefined,
    };
}
