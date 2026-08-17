import { Badge, Button } from "@heroui/react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Compass, Home, Plus, User } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { useUnreadCount } from "~/hooks/useUnreadCount";

interface NavEntry {
    label: string;
    href: string;
    icon: typeof Home;
    badge?: number;
}

/**
 * 移动端底部导航：仅 < md 屏显示，覆盖主导航的常用入口。
 * 中间的「创建」按钮视觉上更突出，未登录时跳转登录页。
 */
export function MobileNav() {
    const pathname = useRouterState({
        select: (s) => s.location.pathname,
    });
    const navigate = useNavigate();
    const { count } = useUnreadCount();
    const { isLoggedIn } = useAuth();

    const isActive = (href: string) =>
        href === "/" ? pathname === "/" : pathname.startsWith(href);

    const items: NavEntry[] = [
        { label: "首页", href: "/", icon: Home },
        { label: "发现", href: "/discover", icon: Compass },
        { label: "消息", href: "/messages", icon: Bell, badge: count },
        { label: "我的", href: "/account", icon: User },
    ];

    const handleCreate = () => {
        if (!isLoggedIn) {
            navigate({
                to: "/auth",
                search: { mode: "login", redirect: "/work/new/edit" },
            });
            return;
        }
        navigate({ to: "/work/new/edit" });
    };

    return (
        <nav
            aria-label="主导航"
            className="fixed inset-x-0 bottom-0 z-50 md:hidden border-t border-default-200/70 bg-background/90 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]"
        >
            <div className="grid grid-cols-5 items-stretch px-2 pt-1.5">
                {items.slice(0, 2).map((item) => (
                    <MobileNavItem
                        key={item.href}
                        item={item}
                        active={isActive(item.href)}
                    />
                ))}

                <div className="flex items-center justify-center">
                    <Button
                        aria-label="创建作品"
                        isIconOnly
                        size="sm"
                        variant="primary"
                        className="size-11 rounded-2xl shadow-none"
                        onPress={handleCreate}
                    >
                        <Plus className="size-5" />
                    </Button>
                </div>

                {items.slice(2).map((item) => (
                    <MobileNavItem
                        key={item.href}
                        item={item}
                        active={isActive(item.href)}
                    />
                ))}
            </div>
        </nav>
    );
}

function MobileNavItem({ item, active }: { item: NavEntry; active: boolean }) {
    return (
        <Link
            to={item.href}
            className="flex flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors"
        >
            <Badge.Anchor>
                <item.icon
                    className={`size-5 ${
                        active ? "text-primary" : "text-foreground/60"
                    }`}
                />
                {item.badge != null && item.badge > 0 && (
                    <Badge size="sm">
                        {item.badge > 99 ? "99+" : item.badge}
                    </Badge>
                )}
            </Badge.Anchor>
            <span
                className={`text-[11px] ${
                    active ? "text-primary font-medium" : "text-foreground/55"
                }`}
            >
                {item.label}
            </span>
        </Link>
    );
}
