import { Button } from "@heroui/react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ADMIN_NAV_ITEMS } from "./adminNavItems";

/**
 * 管理后台横向导航（移动端顶栏，桌面端由 AdminSidebar 替代）。
 */
export function AdminNav({ className }: { className?: string }) {
    const pathname = useRouterState({
        select: (s) => s.location.pathname,
    });
    const isActive = (href: string) =>
        href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

    return (
        <nav
            aria-label="管理后台导航"
            className={`flex gap-1 overflow-x-auto pb-1 scrollbar-hide ${className ?? ""}`}
        >
            {ADMIN_NAV_ITEMS.map((item) => {
                const active = isActive(item.href);
                return (
                    <Link key={item.href} to={item.href} preload="intent">
                        <Button
                            variant={active ? "tertiary" : "ghost"}
                            size="sm"
                            className={`shrink-0 gap-1.5 rounded-full px-3.5 ${
                                active ? "text-accent" : ""
                            }`}
                        >
                            <item.icon className="size-3.5" />
                            <span className="text-[13px]">{item.label}</span>
                        </Button>
                    </Link>
                );
            })}
        </nav>
    );
}
