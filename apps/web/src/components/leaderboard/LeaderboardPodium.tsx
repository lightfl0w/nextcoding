import { Avatar, Card } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { memo } from "react";
import { formatCount } from "~/lib/format";

export type PodiumTo = "/work/$id" | "/user/$id" | "/templates/$id";

export interface PodiumEntry {
    id: string;
    rank: number;
    title: string;
    subtitle?: string | null;
    avatarUrl?: string | null;
    avatarFallback: string;
    value: number;
    valueLabel: string;
    to: PodiumTo;
    params: { id: string };
}

function Medal({ rank }: { rank: number }) {
    if (rank === 1) {
        return <span className="text-4xl sm:text-7xl leading-none">🥇</span>;
    }
    if (rank === 2) {
        return <span className="text-3xl sm:text-6xl leading-none">🥈</span>;
    }
    if (rank === 3) {
        return <span className="text-3xl sm:text-6xl leading-none">🥉</span>;
    }
    return null;
}

/**
 * 排行榜前三名领奖台：3 列、顺序 2-1-3（中间为第一名），
 * 对齐 NextBB 的 TopThreeDisplay 视觉风格。
 */
export const LeaderboardPodium = memo(function LeaderboardPodium({
    items,
}: {
    items: PodiumEntry[];
}) {
    if (items.length === 0) {
        return null;
    }

    const ordered = [items[1], items[0], items[2]].filter(
        Boolean,
    ) as PodiumEntry[];

    return (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {ordered.map((entry) => {
                const isFirst = entry.rank === 1;
                const isSecond = entry.rank === 2;
                return (
                    <Link
                        key={entry.id}
                        to={entry.to}
                        params={entry.params}
                        className={`flex flex-col items-center ${
                            isFirst
                                ? "order-2"
                                : isSecond
                                  ? "order-1"
                                  : "order-3"
                        }`}
                    >
                        <div className="mb-1 sm:mb-2 flex items-center justify-center">
                            <Medal rank={entry.rank} />
                        </div>
                        <Card
                            className={`w-full shadow-none rounded-2xl border transition-transform hover:-translate-y-0.5 ${
                                isFirst
                                    ? "border-warning/40 ring-2 ring-warning/30"
                                    : isSecond
                                      ? "border-default-300/60"
                                      : "border-bronze/30"
                            }`}
                        >
                            <Card.Content className="flex flex-col items-center gap-1 px-2 py-4 sm:py-6 text-center">
                                <Avatar
                                    className={`mx-auto ${
                                        isFirst
                                            ? "size-12 sm:size-16"
                                            : "size-10 sm:size-14"
                                    }`}
                                >
                                    {entry.avatarUrl ? (
                                        <Avatar.Image
                                            alt={entry.title}
                                            src={entry.avatarUrl}
                                        />
                                    ) : null}
                                    <Avatar.Fallback>
                                        {entry.avatarFallback}
                                    </Avatar.Fallback>
                                </Avatar>
                                <p
                                    className={`font-semibold truncate mx-auto max-w-20 sm:max-w-32 ${
                                        isFirst
                                            ? "text-sm sm:text-base"
                                            : "text-xs sm:text-sm"
                                    }`}
                                >
                                    {entry.title}
                                </p>
                                {entry.subtitle ? (
                                    <p className="text-xs text-foreground/45 truncate max-w-20 sm:max-w-32">
                                        {entry.subtitle}
                                    </p>
                                ) : null}
                                <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[10px] sm:text-xs text-foreground/45">
                                        {entry.valueLabel}
                                    </span>
                                    <span className="text-sm sm:text-lg font-bold tabular-nums">
                                        {formatCount(entry.value)}
                                    </span>
                                </div>
                            </Card.Content>
                        </Card>
                    </Link>
                );
            })}
        </div>
    );
});
