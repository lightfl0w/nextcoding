import { Badge, Button } from "@heroui/react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
    Bell,
    BookOpen,
    Compass,
    Crown,
    FilePenLine,
    Home,
    Info,
    Layout,
    type LucideIcon,
    MessageCircle,
    ShieldCheck,
    Tags,
} from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { useUnreadCount } from "~/hooks/useUnreadCount";
import { useUnreadMessageCount } from "~/hooks/useUnreadMessageCount";

type NavItem =
    | { label: string; href: string; icon: LucideIcon }
    | { label: string; href: string; icon: LucideIcon; badge: number };

export function Nav() {
    const pathname = useRouterState({
        select: (s) => s.location.pathname,
    });
    const { count } = useUnreadCount();
    const { count: messageCount } = useUnreadMessageCount();
    const { user } = useAuth();

    const isActive = (href: string) =>
        href === "/" ? pathname === "/" : pathname.startsWith(href);

    const items: NavItem[] = [
        { label: "首页", href: "/", icon: Home },
        { label: "发现", href: "/discover", icon: Compass },
        { label: "标签", href: "/tags", icon: Tags },
        { label: "模板", href: "/templates", icon: Layout },
        { label: "小说", href: "/novels", icon: BookOpen },
        { label: "排行榜", href: "/leaderboard", icon: Crown },
        { label: "草稿", href: "/drafts", icon: FilePenLine },
        { label: "消息", href: "/messages", icon: Bell, badge: count },
        {
            label: "聊天",
            href: "/chat",
            icon: MessageCircle,
            badge: messageCount,
        },
        { label: "关于", href: "/about", icon: Info },
        ...(user?.role === "admin"
            ? [{ label: "管理后台", href: "/admin", icon: ShieldCheck }]
            : []),
    ];

    return (
        <nav className="flex flex-col gap-2">
            {items.map((item) => (
                <Link key={item.href} to={item.href} preload="intent">
                    <NavButton item={item} active={isActive(item.href)} />
                </Link>
            ))}
        </nav>
    );
}

function NavButton({ item, active }: { item: NavItem; active: boolean }) {
    const button = (
        <Button
            variant={active ? "tertiary" : "ghost"}
            fullWidth
            className={`p-5 rounded-xl ${active ? "text-accent" : ""}`}
        >
            <item.icon
                className={`size-4 ${active ? "" : "text-foreground/60"}`}
            />
            <span className="flex-1 text-[15px] tracking-tight text-left">
                {item.label}
            </span>
        </Button>
    );

    if (!("badge" in item) || item.badge <= 0) {
        return button;
    }

    return (
        <Badge.Anchor className="w-full">
            {button}
            <Badge>{item.badge > 99 ? "99+" : item.badge}</Badge>
        </Badge.Anchor>
    );
}
