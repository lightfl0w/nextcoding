import { BookOpen, FileText } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button, Chip } from "@heroui/react";
import { useAuth } from "~/hooks/useAuth";
import type { NovelListItem } from "~/lib/api/novels";

interface NovelsGridProps {
    novels: NovelListItem[];
    isLoading: boolean;
    placeholderCount?: number;
    emptyText?: string;
}

/**
 * 小说卡片网格（与模板卡片同款样式）：封面、状态徽标、标题/简介、作者/章节行、
 * 底部整宽按钮。被小说列表页与发现页复用。
 */
export function NovelsGrid({
    novels,
    isLoading,
    placeholderCount = 6,
    emptyText = "还没有小说",
}: NovelsGridProps) {
    const { user } = useAuth();
    const navigate = useNavigate();

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: placeholderCount }).map((_, i) => (
                    <div
                        key={i}
                        className="h-72 animate-pulse rounded-2xl bg-default-100/60"
                    />
                ))}
            </div>
        );
    }

    if (novels.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-default-200 py-16 text-center text-sm text-foreground/40">
                {emptyText}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {novels.map((novel) => {
                const isOwner = novel.authorId === user?.id;
                // 作者点击卡片/按钮进入编辑器续写，其他人进入阅读页。
                const targetPath = isOwner
                    ? "/novels/$id/edit"
                    : "/novels/$id";
                return (
                    <div
                        key={novel.id}
                        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-default-200/70 bg-surface shadow-sm transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                    >
                        <Link
                            to={targetPath}
                            params={{ id: novel.id }}
                            className="relative block h-40 overflow-hidden bg-default-100/60 ring-1 ring-inset ring-default-200/60 sm:h-44"
                        >
                            {novel.coverUrl ? (
                                <img
                                    src={novel.coverUrl}
                                    alt={novel.title}
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                    <BookOpen className="size-8 text-primary/40" />
                                </div>
                            )}
                            <Chip
                                size="sm"
                                variant="soft"
                                className={`absolute top-2.5 left-2.5 backdrop-blur-sm shadow-sm ${
                                    novel.published
                                        ? "bg-success/15 text-success"
                                        : "bg-background/80 text-foreground/70"
                                }`}
                            >
                                {novel.published ? "已发布" : "草稿"}
                            </Chip>
                        </Link>

                        <div className="flex flex-1 flex-col gap-3.5 p-4 sm:p-5">
                            <Link
                                to={targetPath}
                                params={{ id: novel.id }}
                                className="flex min-w-0 flex-col gap-1"
                            >
                                <h3 className="truncate text-base font-semibold text-foreground transition-colors group-hover:text-accent">
                                    {novel.title}
                                </h3>
                                {novel.description && (
                                    <p className="line-clamp-2 text-sm leading-relaxed text-foreground/60">
                                        {novel.description}
                                    </p>
                                )}
                            </Link>

                            <div className="flex items-center justify-between gap-2 border-t border-default-200/60 pt-3 text-xs text-foreground/50">
                                <span className="flex min-w-0 items-center gap-1.5">
                                    <FileText className="size-3.5 shrink-0" />
                                    <span className="truncate">
                                        {novel.authorName ?? "匿名"}
                                    </span>
                                </span>
                                <span className="flex shrink-0 items-center gap-1.5">
                                    <span>{novel.chapterCount} 章</span>
                                    <span className="text-foreground/25">·</span>
                                    <span>
                                        {new Date(
                                            novel.updatedAt,
                                        ).toLocaleDateString()}
                                    </span>
                                </span>
                            </div>

                            <Button
                                size="sm"
                                variant="primary"
                                fullWidth
                                className="mt-auto"
                                onPress={() =>
                                    navigate({
                                        to: targetPath,
                                        params: { id: novel.id },
                                    })
                                }
                            >
                                <BookOpen className="size-3.5" />
                                {isOwner ? "继续创作" : "阅读"}
                            </Button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
