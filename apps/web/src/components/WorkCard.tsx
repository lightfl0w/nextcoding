import { Avatar, Card, Chip } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { Boxes, Eye, Sparkles } from "lucide-react";
import { memo } from "react";
import { useWorkCardSpark } from "~/hooks/useWorkCardSpark";
import type { Work } from "~/lib/api";
import { formatCount, formatDate } from "~/lib/format";

/**
 * 作品卡片。
 * @param props.work - 作品数据。
 * @remarks 火花按钮就地更新计数，不重新拉列表。
 */
export const WorkCard = memo(function WorkCard({ work }: { work: Work }) {
    const { sparked, count, handleSparkClick } = useWorkCardSpark(work);

    return (
        <div className="h-full group">
            <Card className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-default-200/70 bg-surface p-0 shadow-sm transition-[transform,border-color,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-md">
                <Link
                    to="/work/$id"
                    params={{ id: work.id }}
                    className="relative block aspect-[4/3] w-full overflow-hidden bg-default-100/60 ring-1 ring-inset ring-default-200/60"
                >
                    {work.coverUrl ? (
                        <img
                            src={work.coverUrl}
                            alt={`${work.title} 封面`}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Boxes className="size-8 text-primary/40" />
                        </div>
                    )}
                </Link>

                    <div className="flex flex-col gap-3 p-4 sm:p-5">
                        <Link
                            to="/work/$id"
                            params={{ id: work.id }}
                            className="flex flex-col gap-1 min-w-0"
                        >
                            <Card.Title className="text-sm font-semibold line-clamp-1 group-hover:text-accent transition-colors">
                                {work.title}
                            </Card.Title>
                            <Card.Description className="text-xs leading-relaxed line-clamp-2">
                                {work.description ?? "暂无简介"}
                            </Card.Description>
                        </Link>

                        {Array.isArray(work.tags) && work.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {work.tags.map((tag) => (
                                    <Chip key={tag} size="sm" variant="soft">
                                        <Chip.Label>{tag}</Chip.Label>
                                    </Chip>
                                ))}
                            </div>
                        )}

                        <Card.Footer className="mt-auto justify-between pt-3">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <Avatar size="sm">
                                    <Avatar.Image
                                        src={work.author.image ?? ""}
                                        alt={(work.author.name ?? "?")
                                            .charAt(0)
                                            .toUpperCase()}
                                    />
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
                                    title={sparked ? "已经送过火花" : "火花"}
                                    onClick={handleSparkClick}
                                    className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 transition-colors ${
                                        sparked
                                            ? "text-primary bg-primary/10"
                                            : "hover:text-foreground/80 hover:bg-hover"
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
        </div>
    );
});
