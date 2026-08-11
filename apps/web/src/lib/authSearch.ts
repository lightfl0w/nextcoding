const AUTH_MODES = ["login", "register", "forgot"] as const;

export type AuthMode = (typeof AUTH_MODES)[number];

interface AuthSearch {
    mode: AuthMode;
    redirect: string | undefined;
}

/**
 * 解析登录页查询参数。
 * @param search - 路由查询参数。
 * @returns 归一化后的 `mode` 与 `redirect`；非法 mode 兜底为 `login`。
 */
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
