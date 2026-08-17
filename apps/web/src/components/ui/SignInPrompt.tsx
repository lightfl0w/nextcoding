import { Button } from "@heroui/react";
import { Link, useLocation } from "@tanstack/react-router";
import { LogIn, type LucideIcon } from "lucide-react";

interface SignInPromptProps {
    title: string;
    hint?: string;
    icon?: LucideIcon;
    redirect?: string;
}

/**
 * 整页登录提示：图标 + 标题 + 说明 + 登录按钮。
 * 登录后回跳 redirect（默认当前路径）。
 */
export function SignInPrompt({
    title,
    hint,
    icon: Icon = LogIn,
    redirect,
}: SignInPromptProps) {
    const location = useLocation();
    const target = redirect ?? location.pathname;

    return (
        <div className="p-8 w-full flex flex-col items-center gap-4 py-24">
            <div className="size-12 rounded-full bg-default-100/70 flex items-center justify-center text-foreground/50">
                <Icon className="size-6" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col items-center gap-1">
                <p className="text-base font-medium text-foreground/85">
                    {title}
                </p>
                {hint && <p className="text-xs text-foreground/45">{hint}</p>}
            </div>
            <Link to="/auth" search={{ mode: "login", redirect: target }}>
                <Button variant="primary" className="gap-1.5">
                    <LogIn className="size-3.5" />
                    去登录
                </Button>
            </Link>
        </div>
    );
}
