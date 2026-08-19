import { Avatar, Card } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { Award, Sparkles, Trophy } from "lucide-react";
import { memo, type ReactNode } from "react";
import { EmptyState } from "~/components/ui/EmptyState";
import { LoadingState } from "~/components/ui/LoadingState";
import type {
    LeaderboardContributor,
    LeaderboardWork,
} from "~/lib/api/leaderboard";
import { formatCount } from "~/lib/format";
import { LeaderboardPodium, type PodiumEntry } from "./LeaderboardPodium";

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
        return <LoadingState text="正在加载排行榜…" />;
    }

    if (items.length === 0) {
        return (
            <EmptyState
                icon={Trophy}
                title="暂无上榜数据"
                hint="成为第一个上榜的人吧"
            />
        );
    }

    const top3 = items.slice(0, 3).map((item) => toPodiumEntry(item, type));
    const rest = items.slice(3);

    return (
        <div className="flex flex-col gap-6">
            <LeaderboardPodium items={top3} />
            {rest.length > 0 && (
                <div className="flex flex-col gap-2">
                    <div className="text-sm font-semibold text-foreground/60 px-1">
                        其余排名
                    </div>
                    {rest.map((item) =>
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
            )}
        </div>
    );
}

function toPodiumEntry(
    item: LeaderboardWork | LeaderboardContributor,
    type: "works" | "contributors",
): PodiumEntry {
    if (type === "works") {
        const work = item as LeaderboardWork;
        return {
            id: work.work.id,
            rank: work.position,
            title: work.work.title,
            subtitle: work.work.author?.name ?? null,
            avatarUrl: null,
            avatarFallback: (work.work.title ?? "作").charAt(0).toUpperCase(),
            value: work.sparks,
            valueLabel: "火花",
            to: "/work/$id",
            params: { id: work.work.id },
        };
    }
    const contributor = item as LeaderboardContributor;
    return {
        id: contributor.author.id ?? "",
        rank: contributor.position,
        title: contributor.author.name ?? "未命名用户",
        subtitle: null,
        avatarUrl: contributor.author.image ?? null,
        avatarFallback: (contributor.author.name ?? "用")
            .charAt(0)
            .toUpperCase(),
        value: contributor.totalSparks,
        valueLabel: "火花",
        to: "/user/$id",
        params: { id: contributor.author.id ?? "" },
    };
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
            bg: "bg-bronze/12",
            text: "text-bronze",
            border: "border-bronze/30",
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
    return (
        <Link to="/work/$id" params={{ id: item.work.id }}>
            <RankRowCard position={item.position} sparks={item.sparks}>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                        {item.work.title}
                    </p>
                    <p className="text-xs text-foreground/45 mt-0.5">
                        {item.work.author.name ?? "未命名用户"}
                    </p>
                </div>
            </RankRowCard>
        </Link>
    );
});

const ContributorRow = memo(function ContributorRow({
    item,
}: {
    item: LeaderboardContributor;
}) {
    return (
        <Link to="/user/$id" params={{ id: item.author.id ?? "" }}>
            <RankRowCard position={item.position} sparks={item.totalSparks}>
                <Avatar size="sm" className="shrink-0">
                    {item.author.image ? (
                        <Avatar.Image
                            alt={item.author.name ?? "用户"}
                            src={item.author.image}
                        />
                    ) : null}
                    <Avatar.Fallback>
                        {(item.author.name ?? "用").charAt(0).toUpperCase()}
                    </Avatar.Fallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                        {item.author.name ?? "未命名用户"}
                    </p>
                </div>
            </RankRowCard>
        </Link>
    );
});

function RankRowCard({
    position,
    sparks,
    children,
}: {
    position: number;
    sparks: number;
    children: ReactNode;
}) {
    const rankStyle = getRankStyle(position);

    return (
        <Card
            className={`p-0 shadow-none rounded-2xl border transition-colors hover:bg-hover ${
                rankStyle
                    ? `${rankStyle.border} border`
                    : "border-default-200/70"
            }`}
        >
            <Card.Content className="px-4 py-3">
                <div className="flex items-center gap-3">
                    <RankBadge position={position} />
                    {children}
                    <div className="flex items-center gap-1.5 text-warning shrink-0">
                        <Sparkles className="size-3.5" />
                        <span className="text-sm font-semibold tabular-nums">
                            {formatCount(sparks)}
                        </span>
                    </div>
                </div>
            </Card.Content>
        </Card>
    );
}
