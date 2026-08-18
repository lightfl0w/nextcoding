import { Avatar } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { GitFork, Heart, Loader2, MessageSquare, Sparkles } from "lucide-react";
import { memo } from "react";
import type { TemplateUseRecord } from "~/lib/api/templates";
import { formatCount, formatDate } from "~/lib/format";

/**
 * 模板派生树：展示使用此模板创作的作品节点。
 * @param props.uses - 派生记录列表。
 * @param props.isLoading - 加载中。
 */
export const TemplateUseTree = memo(function TemplateUseTree({
    uses,
    isLoading,
}: {
    uses: TemplateUseRecord[];
    isLoading: boolean;
}) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 text-foreground/30 animate-spin" />
            </div>
        );
    }

    if (uses.length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 py-6 text-foreground/40">
                <GitFork className="size-5" strokeWidth={1.5} />
                <p className="text-sm">还没有人基于此模板创作</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-foreground/45 mb-1">
                <GitFork className="size-3.5" />
                派生作品 {uses.length} 个
            </div>
            <div className="flex flex-col gap-1">
                {uses.map((use) => (
                    <Link
                        key={use.id}
                        to="/work/$id"
                        params={{ id: use.workId }}
                        className="flex flex-col gap-1 px-2.5 py-2 rounded-lg hover:bg-hover transition-colors min-w-0"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate text-sm font-medium">
                                {use.workTitle}
                            </span>
                            {use.workStatus === "published" ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/10 text-success shrink-0">
                                    已发布
                                </span>
                            ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-default-100 text-foreground/50 shrink-0">
                                    草稿
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-foreground/45 min-w-0">
                            <span className="flex items-center gap-1 min-w-0">
                                {use.userImage ? (
                                    <Avatar size="sm" className="shrink-0">
                                        <Avatar.Image
                                            src={use.userImage}
                                            alt={use.userName ?? "用户"}
                                        />
                                        <Avatar.Fallback>
                                            {use.userName?.charAt(0) ?? "?"}
                                        </Avatar.Fallback>
                                    </Avatar>
                                ) : null}
                                <span className="truncate">
                                    {use.userName ?? "匿名用户"}
                                </span>
                            </span>
                            <span className="shrink-0">
                                {formatDate(use.createdAt)}
                            </span>
                            <span className="ml-auto flex items-center gap-2 shrink-0">
                                <span className="flex items-center gap-0.5">
                                    <Heart className="size-3" />
                                    {formatCount(use.workLikes)}
                                </span>
                                <span className="flex items-center gap-0.5">
                                    <Sparkles className="size-3" />
                                    {formatCount(use.workSparks)}
                                </span>
                                <span className="flex items-center gap-0.5">
                                    <MessageSquare className="size-3" />
                                    {formatCount(use.commentCount)}
                                </span>
                            </span>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
});
