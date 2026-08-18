import { Avatar, Button, Chip } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { Boxes, LayoutTemplate, User } from "lucide-react";
import { memo } from "react";
import type { Template } from "~/lib/api/templates";
import { formatCount } from "~/lib/format";
import { templateCategoryLabel } from "~/lib/templateCategories";
import { StarRating } from "./StarRating";

interface TemplateCardProps {
    template: Template;
    onUse: (id: string) => void;
}

/**
 * 模板市场卡片：封面、描述、作者、评分与使用操作。
 * @param props.template - 模板数据。
 * @param props.onUse - 使用模板回调。
 */
export const TemplateCard = memo(function TemplateCard({
    template,
    onUse,
}: TemplateCardProps) {
    return (
        <div className="group rounded-2xl border border-default-200/70 overflow-hidden hover:border-default-300 hover:-translate-y-0.5 transition-[transform,border-color] duration-200 bg-background flex flex-col">
            <Link
                to="/templates/$id"
                params={{ id: template.id }}
                className="block relative h-32 overflow-hidden bg-gradient-to-br from-primary/15 via-secondary/10 to-primary/5"
            >
                {template.coverUrl ? (
                    <img
                        src={template.coverUrl}
                        alt={template.title}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <LayoutTemplate className="size-8 text-primary/40" />
                    </div>
                )}
                {template.category && (
                    <Chip
                        size="sm"
                        variant="soft"
                        className="absolute top-2.5 left-2.5 bg-background/80 backdrop-blur-sm"
                    >
                        {templateCategoryLabel(template.category)}
                    </Chip>
                )}
            </Link>

            <div className="p-4 flex flex-col gap-3 flex-1">
                <Link
                    to="/templates/$id"
                    params={{ id: template.id }}
                    className="flex flex-col gap-1 min-w-0"
                >
                    <h3 className="text-base font-semibold truncate text-foreground group-hover:text-accent transition-colors">
                        {template.title}
                    </h3>
                    {template.description && (
                        <p className="text-sm text-foreground/60 line-clamp-2 leading-relaxed">
                            {template.description}
                        </p>
                    )}
                </Link>

                <div className="flex items-center justify-between gap-2 text-xs text-foreground/50">
                    <span className="flex items-center gap-1.5 min-w-0">
                        {template.authorImage ? (
                            <Avatar size="sm" className="shrink-0">
                                <Avatar.Image
                                    src={template.authorImage}
                                    alt={template.authorName ?? "作者"}
                                />
                                <Avatar.Fallback>
                                    {template.authorName
                                        ?.charAt(0)
                                        .toUpperCase() ?? (
                                        <User className="size-3" />
                                    )}
                                </Avatar.Fallback>
                            </Avatar>
                        ) : (
                            <Boxes className="size-3.5 shrink-0" />
                        )}
                        <span className="truncate">
                            {template.authorName ?? "官方模板"}
                        </span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                        <span>{formatCount(template.useCount)} 次使用</span>
                        <span className="text-foreground/25">·</span>
                        <StarRating rating={template.rating} size={11} />
                    </span>
                </div>

                <Button
                    size="sm"
                    variant="primary"
                    fullWidth
                    className="mt-auto"
                    onPress={() => onUse(template.id)}
                >
                    <LayoutTemplate className="size-3.5" />
                    使用此模板
                </Button>
            </div>
        </div>
    );
});
