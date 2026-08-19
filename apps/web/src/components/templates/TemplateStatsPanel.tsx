import { Avatar } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { Boxes, Heart, Loader2, MessageSquare, Sparkles } from "lucide-react";
import { memo } from "react";
import { useTemplateStats } from "~/hooks/useTemplateStats";
import { formatCount, formatDate } from "~/lib/format";

/**
 * 模板使用数据面板（模板作者专属）。
 * @param props.templateId - 模板 ID。
 * @remarks 展示使用记录与派生作品互动汇总。
 */
export const TemplateStatsPanel = memo(function TemplateStatsPanel({
    templateId,
}: {
    templateId: string;
}) {
    const { stats, isLoading } = useTemplateStats(templateId);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 text-foreground/30 animate-spin" />
            </div>
        );
    }

    if (!stats) {
        return (
            <p className="text-sm text-foreground/45 py-6 text-center">
                数据面板仅模板作者可见
            </p>
        );
    }

    const statCards = [
        { label: "总使用次数", value: stats.totalUses, icon: Boxes },
        { label: "派生作品", value: stats.stats.works, icon: Boxes },
        { label: "累计点赞", value: stats.stats.likes, icon: Heart },
        { label: "累计火花", value: stats.stats.sparks, icon: Sparkles },
        { label: "累计评论", value: stats.stats.comments, icon: MessageSquare },
    ];

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2.5">
                {statCards.map((item) => (
                    <div
                        key={item.label}
                        className="rounded-xl border border-default-200/70 p-3.5 flex flex-col gap-1.5"
                    >
                        <span className="flex items-center gap-1.5 text-xs text-foreground/45 whitespace-nowrap">
                            <item.icon className="size-3.5 shrink-0" />
                            {item.label}
                        </span>
                        <span className="text-lg font-semibold text-foreground">
                            {formatCount(item.value)}
                        </span>
                    </div>
                ))}
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <Boxes className="size-4 text-primary" />
                    使用记录
                </div>
                {stats.uses.length === 0 ? (
                    <p className="text-sm text-foreground/40 py-4 text-center">
                        还没有人使用这个模板
                    </p>
                ) : (
                    <div className="flex flex-col gap-1">
                        {stats.uses.map((use) => (
                            <Link
                                key={use.id}
                                to="/work/$id"
                                params={{ id: use.workId }}
                                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-hover transition-colors min-w-0"
                            >
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
                                ) : (
                                    <span className="size-7 rounded-full bg-default-100 flex items-center justify-center text-xs text-foreground/50 shrink-0">
                                        {use.userName?.charAt(0) ?? "?"}
                                    </span>
                                )}
                                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                    <span className="text-sm truncate">
                                        {use.workTitle}
                                    </span>
                                    <span className="text-xs text-foreground/40">
                                        {use.userName ?? "匿名用户"} ·{" "}
                                        {formatDate(use.createdAt)}
                                    </span>
                                </div>
                                <span className="flex items-center gap-2 text-xs text-foreground/45 shrink-0">
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
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
});
