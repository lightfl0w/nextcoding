import { Avatar, Card } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { Award, Flame, Trophy } from "lucide-react";
import { memo } from "react";
import { EmptyState } from "~/components/ui/EmptyState";
import { LoadingState } from "~/components/ui/LoadingState";
import { useTemplateLeaderboard } from "~/hooks/useTemplateLeaderboard";
import { formatCount } from "~/lib/format";
import { LeaderboardPodium, type PodiumEntry } from "../leaderboard/LeaderboardPodium";
import { StarRating } from "./StarRating";

/**
 * 模板热度榜主区域列表：用于排行榜页面的"模板"Tab。
 * @param props.limit - 榜单条数。
 */
export const TemplateLeaderboardList = memo(function TemplateLeaderboardList({
    limit = 20,
}: {
    limit?: number;
}) {
    const { templates, isLoading } = useTemplateLeaderboard(limit);

    if (isLoading) {
        return <LoadingState text="正在加载模板榜…" />;
    }

    if (templates.length === 0) {
        return (
            <EmptyState
                icon={Trophy}
                title="暂无模板上榜"
                hint="发布模板并积累使用量即可上榜"
            />
        );
    }

    const top3 = templates
        .slice(0, 3)
        .map((template, index) => toPodiumEntry(template, index + 1));
    const rest = templates.slice(3);

    return (
        <div className="flex flex-col gap-6">
            <LeaderboardPodium items={top3} />
            {rest.length > 0 && (
                <div className="flex flex-col gap-2">
                    <div className="text-sm font-semibold text-foreground/60 px-1">
                        其余排名
                    </div>
                    {rest.map((template, index) => (
                        <TemplateRow
                            key={template.id}
                            position={index + 4}
                            template={template}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});

function toPodiumEntry(
    template: {
        id: string;
        title: string;
        authorName: string | null;
        authorImage: string | null;
        useCount: number;
        rating: number;
    },
    rank: number,
): PodiumEntry {
    return {
        id: template.id,
        rank,
        title: template.title,
        subtitle: template.authorName ?? null,
        avatarUrl: template.authorImage ?? null,
        avatarFallback: (template.title ?? "模").charAt(0).toUpperCase(),
        value: template.useCount,
        valueLabel: "次使用",
        to: "/templates/$id",
        params: { id: template.id },
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

const TemplateRow = memo(function TemplateRow({
    position,
    template,
}: {
    position: number;
    template: {
        id: string;
        title: string;
        authorName: string | null;
        authorImage: string | null;
        useCount: number;
        rating: number;
    };
}) {
    const rankStyle = getRankStyle(position);

    return (
        <Link to="/templates/$id" params={{ id: template.id }}>
            <Card
                className={`p-0 shadow-none rounded-2xl border transition-colors hover:bg-hover ${
                    rankStyle ? rankStyle.border : "border-default-200/70"
                }`}
            >
                <Card.Content className="px-4 py-3">
                    <div className="flex items-center gap-3">
                        <RankBadge position={position} />
                        <Avatar size="sm" className="shrink-0">
                            {template.authorImage ? (
                                <Avatar.Image
                                    alt={template.authorName ?? "模板"}
                                    src={template.authorImage}
                                />
                            ) : null}
                            <Avatar.Fallback>
                                {(template.title ?? "模").charAt(0)}
                            </Avatar.Fallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                                {template.title}
                            </p>
                            <p className="text-xs text-foreground/45 mt-0.5 truncate">
                                {template.authorName ?? "官方模板"}
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                            <div className="flex items-center gap-1 text-primary">
                                <Flame className="size-3.5" />
                                <span className="text-sm font-semibold tabular-nums">
                                    {formatCount(template.useCount)}
                                </span>
                            </div>
                            <StarRating rating={template.rating} size={10} />
                        </div>
                    </div>
                </Card.Content>
            </Card>
        </Link>
    );
});
