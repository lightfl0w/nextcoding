import { Avatar, Card, Chip } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { Eye, Sparkles } from "lucide-react";
import { memo } from "react";
import { useWorkCardSpark } from "~/hooks/useWorkCardSpark";
import type { Work } from "~/lib/api";
import { formatCount, formatDate } from "~/lib/format";

export const WorkCard = memo(function WorkCard({ work }: { work: Work }) {
    const { sparked, count, handleSparkClick } = useWorkCardSpark(work);

    return (
        <Link
            to="/work/$id"
            params={{ id: work.id }}
            className="block h-full group"
        >
            <Card className="w-full p-0 shadow-none rounded-2xl overflow-hidden h-full border border-default-200/70 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-default-300 group-hover:shadow-lg">
                <div className="p-4 flex flex-col gap-2.5 h-full">
                    <Card.Header className="gap-1">
                        <Card.Title className="text-sm font-semibold line-clamp-1">
                            {work.title}
                        </Card.Title>
                        <Card.Description className="text-xs leading-relaxed line-clamp-2">
                            {work.description ?? "暂无简介"}
                        </Card.Description>
                    </Card.Header>

                    {Array.isArray(work.tags) && work.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {work.tags.map((tag) => (
                                <Chip key={tag} size="sm" variant="soft">
                                    <Chip.Label>{tag}</Chip.Label>
                                </Chip>
                            ))}
                        </div>
                    )}

                    <Card.Footer className="justify-between mt-auto">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <Avatar size="sm">
                                <Avatar.Fallback>
                                    {(work.author.name ?? "?")
                                        .charAt(0)
                                        .toUpperCase()}
                                </Avatar.Fallback>
                            </Avatar>
                            <span className="text-xs truncate">
                                {work.author.name ?? "匿名"}
                            </span>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs text-foreground/60 tabular-nums">
                            <button
                                type="button"
                                title={sparked ? "已经送过火花" : "送火花"}
                                onClick={handleSparkClick}
                                className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 transition-colors ${
                                    sparked
                                        ? "text-primary bg-primary/10"
                                        : "hover:text-foreground/80 hover:bg-default-100"
                                }`}
                            >
                                <Sparkles
                                    className="size-3"
                                    fill={sparked ? "currentColor" : "none"}
                                />
                                {formatCount(count)}
                            </button>
                            <span
                                className="flex items-center gap-0.5"
                                title={`${work.views} 次浏览`}
                            >
                                <Eye className="size-3" />
                                {formatCount(work.views)}
                            </span>
                            <span
                                className="flex items-center gap-0.5"
                                title={new Date(
                                    work.createdAt,
                                ).toLocaleString()}
                            >
                                {formatDate(work.createdAt)}
                            </span>
                        </div>
                    </Card.Footer>
                </div>
            </Card>
        </Link>
    );
});
