import { Avatar, Card, Spinner } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { Award, Sparkles } from "lucide-react";
import { memo } from "react";
import type {
    LeaderboardContributor,
    LeaderboardWork,
} from "~/lib/api/leaderboard";
import { formatCount } from "~/lib/format";

interface LeaderboardTableProps {
    items: LeaderboardWork[] | LeaderboardContributor[];
    type: "works" | "contributors";
    isLoading?: boolean;
}

export function LeaderboardTable({
    items,
    type,
    isLoading,
}: LeaderboardTableProps) {
    if (isLoading) {
        return <LeaderboardSkeleton />;
    }

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-foreground/40">
                <p className="text-sm">暂无数据</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {items.map((item) =>
                type === "works" ? (
                    <WorkRow
                        key={(item as LeaderboardWork).work.id}
                        item={item as LeaderboardWork}
                    />
                ) : (
                    <ContributorRow
                        key={(item as LeaderboardContributor).author.id}
                        item={item as LeaderboardContributor}
                    />
                ),
            )}
        </div>
    );
}

function getRankStyle(position: number) {
    if (position === 1) {
        return {
            bg: "bg-warning/15",
            text: "text-warning",
            border: "border-warning/30",
        };
    }
    if (position === 2) {
        return {
            bg: "bg-default-200/40",
            text: "text-foreground/60",
            border: "border-default-300/50",
        };
    }
    if (position === 3) {
        return {
            bg: "bg-orange-500/10",
            text: "text-orange-500",
            border: "border-orange-500/25",
        };
    }
    return null;
}

function RankBadge({ position }: { position: number }) {
    const rankStyle = getRankStyle(position);

    if (rankStyle) {
        return (
            <div
                className={`size-8 rounded-lg flex items-center justify-center ${rankStyle.bg} ${rankStyle.text}`}
            >
                {position <= 3 ? (
                    <Award className="size-4" />
                ) : (
                    <span className="text-sm font-semibold tabular-nums">
                        {position}
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className="size-8 rounded-lg flex items-center justify-center bg-default-100/70 text-foreground/50">
            <span className="text-sm font-semibold tabular-nums">
                {position}
            </span>
        </div>
    );
}

const WorkRow = memo(function WorkRow({ item }: { item: LeaderboardWork }) {
    const rankStyle = getRankStyle(item.position);

    return (
        <Link to="/work/$id" params={{ id: item.work.id }}>
            <Card
                className={`p-0 shadow-none rounded-2xl border transition-colors hover:bg-default-100/50 ${
                    rankStyle
                        ? `${rankStyle.border} border`
                        : "border-default-200/70"
                }`}
            >
                <Card.Content className="px-4 py-3">
                    <div className="flex items-center gap-3">
                        <RankBadge position={item.position} />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                                {item.work.title}
                            </p>
                            <p className="text-xs text-foreground/45 mt-0.5">
                                {item.work.author.name ?? "未命名用户"}
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-warning shrink-0">
                            <Sparkles className="size-3.5" />
                            <span className="text-sm font-semibold tabular-nums">
                                {formatCount(item.sparks)}
                            </span>
                        </div>
                    </div>
                </Card.Content>
            </Card>
        </Link>
    );
});

const ContributorRow = memo(function ContributorRow({
    item,
}: {
    item: LeaderboardContributor;
}) {
    const rankStyle = getRankStyle(item.position);

    return (
        <Link to="/user/$id" params={{ id: item.author.id ?? "" }}>
            <Card
                className={`p-0 shadow-none rounded-2xl border transition-colors hover:bg-default-100/50 ${
                    rankStyle
                        ? `${rankStyle.border} border`
                        : "border-default-200/70"
                }`}
            >
                <Card.Content className="px-4 py-3">
                    <div className="flex items-center gap-3">
                        <RankBadge position={item.position} />
                        <Avatar size="sm" className="shrink-0">
                            {item.author.image ? (
                                <Avatar.Image
                                    alt={item.author.name ?? "用户"}
                                    src={item.author.image}
                                />
                            ) : null}
                            <Avatar.Fallback>
                                {(item.author.name ?? "用")
                                    .charAt(0)
                                    .toUpperCase()}
                            </Avatar.Fallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                                {item.author.name ?? "未命名用户"}
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-warning shrink-0">
                            <Sparkles className="size-3.5" />
                            <span className="text-sm font-semibold tabular-nums">
                                {formatCount(item.totalSparks)}
                            </span>
                        </div>
                    </div>
                </Card.Content>
            </Card>
        </Link>
    );
});

function LeaderboardSkeleton() {
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-foreground/40">
            <Spinner size="sm" />
            <span className="text-sm">正在加载排行榜…</span>
        </div>
    );
}
