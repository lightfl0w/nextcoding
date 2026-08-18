import { Link } from "@tanstack/react-router";
import { Flame, Loader2 } from "lucide-react";
import { memo } from "react";
import { useTemplateLeaderboard } from "~/hooks/useTemplateLeaderboard";
import { formatCount } from "~/lib/format";
import { StarRating } from "./StarRating";

/**
 * 模板热度榜：按使用次数排序的 Top 榜单。
 * @param props.limit - 榜单条数。
 */
export const TemplateLeaderboard = memo(function TemplateLeaderboard({
    limit = 10,
}: {
    limit?: number;
}) {
    const { templates, isLoading } = useTemplateLeaderboard(limit);

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-1">
                <Flame className="size-4 text-primary" />
                模板热度榜
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-5 text-foreground/30 animate-spin" />
                </div>
            ) : templates.length === 0 ? (
                <p className="text-sm text-foreground/40 py-6 text-center">
                    暂无模板
                </p>
            ) : (
                <div className="flex flex-col gap-0.5">
                    {templates.map((template, index) => (
                        <Link
                            key={template.id}
                            to="/templates/$id"
                            params={{ id: template.id }}
                            className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-hover transition-colors min-w-0"
                        >
                            <span
                                className={`w-5 text-center text-sm font-bold shrink-0 ${
                                    index < 3
                                        ? "text-primary"
                                        : "text-foreground/35"
                                }`}
                            >
                                {index + 1}
                            </span>
                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                <span className="text-sm truncate">
                                    {template.title}
                                </span>
                                <span className="text-xs text-foreground/40 truncate">
                                    {template.authorName ?? "官方模板"}
                                </span>
                            </div>
                            <div className="flex flex-col items-end gap-0.5 shrink-0">
                                <span className="text-xs text-foreground/50">
                                    {formatCount(template.useCount)} 次
                                </span>
                                <StarRating
                                    rating={template.rating}
                                    size={10}
                                />
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
});
