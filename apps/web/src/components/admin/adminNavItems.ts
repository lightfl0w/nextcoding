import {
    FileCode2,
    LayoutDashboard,
    type LucideIcon,
    MessageSquareQuote,
    Tags,
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
    { label: "标签", href: "/admin/tags", icon: Tags },
];
