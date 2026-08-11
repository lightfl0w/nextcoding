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
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl border border-foreground/10">
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
            className={
                active
                    ? "bg-foreground/5 text-foreground rounded-lg py-2 text-center text-sm font-medium"
                    : "text-foreground/50 hover:text-foreground py-2 text-center text-sm font-medium"
            }
        >
            {label}
        </Link>
    );
}
