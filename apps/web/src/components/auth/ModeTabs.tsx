import { Link } from "@tanstack/react-router";
import type { AuthMode } from "~/lib/authSearch";

export function ModeTabs({
    mode,
    redirect,
}: {
    mode: AuthMode;
    redirect: string;
}) {
    return (
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl border border-default-200/70">
            <ModeLink
                mode="login"
                current={mode}
                redirect={redirect}
                label="登录"
            />
            <ModeLink
                mode="register"
                current={mode}
                redirect={redirect}
                label="注册"
            />
        </div>
    );
}

function ModeLink({
    mode,
    current,
    redirect,
    label,
}: {
    mode: AuthMode;
    current: AuthMode;
    redirect: string;
    label: string;
}) {
    const active = mode === current;
    return (
        <Link
            to="/auth"
            search={{ mode, redirect }}
            className={`py-2 text-center text-sm font-medium transition-colors rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                active
                    ? "bg-hover-strong text-foreground"
                    : "text-foreground/50 hover:text-foreground hover:bg-hover"
            }`}
        >
            {label}
        </Link>
    );
}
