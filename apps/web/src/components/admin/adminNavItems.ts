import {
    FileCode2,
    Flag,
    LayoutDashboard,
    LayoutTemplate,
    type LucideIcon,
    MessageCircle,
    MessageSquareQuote,
    Tags,
    Trophy,
    Users,
} from "lucide-react";

export interface AdminNavItem {
    label: string;
    href: string;
    icon: LucideIcon;
}

/**
 * 管理后台导航项，供侧边栏与移动端顶栏共用。
 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
    { label: "仪表盘", href: "/admin", icon: LayoutDashboard },
    { label: "用户", href: "/admin/users", icon: Users },
    { label: "作品", href: "/admin/works", icon: FileCode2 },
    { label: "评论", href: "/admin/comments", icon: MessageSquareQuote },
    { label: "模板", href: "/admin/templates", icon: LayoutTemplate },
    { label: "举报", href: "/admin/reports", icon: Flag },
    { label: "聊天", href: "/admin/messages", icon: MessageCircle },
    { label: "成就", href: "/admin/achievements", icon: Trophy },
    { label: "标签", href: "/admin/tags", icon: Tags },
];
