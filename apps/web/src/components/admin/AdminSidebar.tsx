import { Button } from "@heroui/react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { UserInfo } from "~/components/ui/Sidebar/UserInfo";
import { ADMIN_NAV_ITEMS } from "./adminNavItems";

/**
 * 管理后台侧边栏：品牌区 + 垂直导航 + 返回网站 + 用户信息。
 * 仅桌面端显示，移动端使用顶部的 AdminNav 横向导航。
 */
export function AdminSidebar() {
    const pathname = useRouterState({
        select: (s) => s.location.pathname,
    });
    const isActive = (href: string) =>
        href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

    return (
        <aside className="sticky top-0 h-screen hidden md:flex md:w-60 text-foreground shrink-0 flex-col  bg-surface-secondary">
            <div className="w-full p-5 flex flex-col gap-8 overflow-y-auto flex-1 min-h-0">
                <Link
                    to="/admin"
                    className="flex items-center gap-2.5 w-fit"
                    preload="intent"
                >
                    <ShieldCheck className="size-5 text-accent" />
                    <span className="text-lg font-bold tracking-tight">
                        管理后台
                    </span>
                </Link>

                <nav aria-label="管理后台导航" className="flex flex-col gap-2">
                    {ADMIN_NAV_ITEMS.map((item) => {
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                preload="intent"
                            >
                                <Button
                                    variant={active ? "tertiary" : "ghost"}
                                    fullWidth
                                    className={`p-5 rounded-xl ${
                                        active ? "text-accent" : ""
                                    }`}
                                >
                                    <item.icon
                                        className={`size-4 ${
                                            active ? "" : "text-foreground/60"
                                        }`}
                                    />
                                    <span className="flex-1 text-[15px] tracking-tight text-left">
                                        {item.label}
                                    </span>
                                </Button>
                            </Link>
                        );
                    })}

                    <div className="mt-2 border-t border-default-100 pt-2">
                        <Link to="/" preload="intent">
                            <Button
                                variant="ghost"
                                fullWidth
                                className="p-5 rounded-xl"
                            >
                                <ArrowLeft className="size-4 text-foreground/60" />
                                <span className="flex-1 text-[15px] tracking-tight text-left">
                                    返回网站
                                </span>
                            </Button>
                        </Link>
                    </div>
                </nav>
            </div>

            <div className="w-full p-5 border-t border-default-100">
                <UserInfo />
            </div>
        </aside>
    );
}
