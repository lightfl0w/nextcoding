import { ToggleButton } from "@heroui/react";
import { Bell, GitFork, MessageSquare, Sparkles } from "lucide-react";
import type {
    NotificationCounts,
    NotificationTypeFilter,
} from "~/lib/notifications";

const TYPE_OPTIONS: ReadonlyArray<{
    key: NotificationTypeFilter;
    label: string;
    icon: typeof Sparkles;
}> = [
    { key: "all", label: "全部", icon: Bell },
    { key: "spark", label: "火花", icon: Sparkles },
    { key: "remix", label: "二创", icon: GitFork },
    { key: "comment", label: "评论", icon: MessageSquare },
];

function typeCounts(
    counts: NotificationCounts,
): Record<NotificationTypeFilter, { count: number; unread: number }> {
    return {
        all: { count: counts.total, unread: counts.unread },
        spark: { count: counts.spark, unread: counts.sparkUnread },
        remix: { count: counts.remix, unread: counts.remixUnread },
        comment: { count: counts.comment, unread: counts.commentUnread },
    };
}

export function MessagesSidebar({
    counts,
    typeFilter,
    onTypeFilterChange,
}: {
    counts: NotificationCounts;
    typeFilter: NotificationTypeFilter;
    onTypeFilterChange: (next: NotificationTypeFilter) => void;
}) {
    const countsByType = typeCounts(counts);

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
                {TYPE_OPTIONS.map(({ key, label, icon: Icon }) => {
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
                                {countsByType[key].count}
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
    const countsByType = typeCounts(counts);
    return (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {TYPE_OPTIONS.map(({ key, label }) => {
                const selected = typeFilter === key;
                return (
                    <button
                        key={key}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onTypeFilterChange(key)}
                        className={`shrink-0 h-8 px-3 rounded-full text-sm border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                            selected
                                ? "border-default-300 bg-hover-strong text-foreground"
                                : "border-default-200/70 bg-background text-foreground/65 hover:bg-hover"
                        }`}
                    >
                        <span className="flex items-center gap-1.5">
                            {label}
                            <span className="text-xs text-foreground/45 tabular-nums">
                                {countsByType[key].count}
                            </span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
