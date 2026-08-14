import { ToggleButton } from "@heroui/react";
import { Bell, GitFork, MessageSquare, Sparkles } from "lucide-react";
import type {
    NotificationCounts,
    NotificationTypeFilter,
} from "~/lib/notifications";

export function MessagesSidebar({
    counts,
    typeFilter,
    onTypeFilterChange,
}: {
    counts: NotificationCounts;
    typeFilter: NotificationTypeFilter;
    onTypeFilterChange: (next: NotificationTypeFilter) => void;
}) {
    const options: Array<{
        key: NotificationTypeFilter;
        label: string;
        count: number;
        unread: number;
        icon: typeof Sparkles;
    }> = [
        {
            key: "all",
            label: "全部",
            count: counts.total,
            unread: counts.unread,
            icon: Bell,
        },
        {
            key: "spark",
            label: "火花",
            count: counts.spark,
            unread: counts.sparkUnread,
            icon: Sparkles,
        },
        {
            key: "remix",
            label: "二创",
            count: counts.remix,
            unread: counts.remixUnread,
            icon: GitFork,
        },
        {
            key: "comment",
            label: "评论",
            count: counts.comment,
            unread: counts.commentUnread,
            icon: MessageSquare,
        },
    ];

    return (
        <aside className="hidden md:flex flex-col gap-4 min-w-0">
            <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-foreground/45 uppercase tracking-wider">
                    分类
                </span>
                <span className="text-xs text-foreground/40">
                    按通知类型快速筛选
                </span>
            </div>
            <nav className="flex flex-col gap-1" aria-label="通知类型">
                {options.map(({ key, label, count, unread, icon: Icon }) => {
                    const selected = typeFilter === key;
                    return (
                        <ToggleButton
                            key={key}
                            isSelected={selected}
                            onChange={() => onTypeFilterChange(key)}
                            aria-label={`筛选 ${label}`}
                            className="w-full group h-auto justify-start gap-2.5 px-3 py-2 rounded-xl data-[selected=true]:bg-default-100"
                        >
                            <Icon
                                className="size-4 text-foreground/55 group-data-[selected=true]:text-foreground/80"
                                strokeWidth={1.75}
                            />
                            <span className="flex flex-1 items-center gap-1.5 min-w-0">
                                <span className="text-sm">{label}</span>
                            </span>
                            <span className="text-xs text-foreground/40 tabular-nums shrink-0">
                                {count}
                            </span>
                        </ToggleButton>
                    );
                })}
            </nav>
        </aside>
    );
}

export function MobileTypeFilter({
    typeFilter,
    onTypeFilterChange,
    counts,
}: {
    typeFilter: NotificationTypeFilter;
    onTypeFilterChange: (next: NotificationTypeFilter) => void;
    counts: NotificationCounts;
}) {
    const tabs: Array<{
        key: NotificationTypeFilter;
        label: string;
        count: number;
    }> = [
        { key: "all", label: "全部", count: counts.total },
        { key: "spark", label: "火花", count: counts.spark },
        { key: "remix", label: "二创", count: counts.remix },
        { key: "comment", label: "评论", count: counts.comment },
    ];
    return (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {tabs.map(({ key, label, count }) => {
                const selected = typeFilter === key;
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onTypeFilterChange(key)}
                        className={`shrink-0 h-8 px-3 rounded-full text-sm border transition-colors ${
                            selected
                                ? "border-default-300 bg-default-100 text-foreground"
                                : "border-default-200/70 bg-background text-foreground/65"
                        }`}
                    >
                        <span className="flex items-center gap-1.5">
                            {label}
                            <span className="text-xs text-foreground/45 tabular-nums">
                                {count}
                            </span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
