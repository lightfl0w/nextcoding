import { Avatar, Button, Chip, toast } from "@heroui/react";
import {
    createFileRoute,
    Link,
    useNavigate,
    useParams,
} from "@tanstack/react-router";
import {
    Boxes,
    CalendarDays,
    LayoutTemplate,
    Loader2,
    Sparkles,
} from "lucide-react";
import { useState } from "react";
import { StarRating } from "~/components/templates/StarRating";
import { TemplateLeaderboard } from "~/components/templates/TemplateLeaderboard";
import { TemplateStatsPanel } from "~/components/templates/TemplateStatsPanel";
import { TemplateUseTree } from "~/components/templates/TemplateUseTree";
import { EmptyState } from "~/components/ui/EmptyState";
import { useAuth } from "~/hooks/useAuth";
import { useTemplate } from "~/hooks/useTemplate";
import { useTemplateTree } from "~/hooks/useTemplateTree";
import { applyTemplate, rateTemplate } from "~/lib/api/templates";
import { formatCount, formatDate } from "~/lib/format";
import { templateCategoryLabel } from "~/lib/templateCategories";

export const Route = createFileRoute("/templates/$id/")({
    component: TemplateDetailPage,
});

function TemplateDetailPage() {
    const { id } = useParams({ from: "/templates/$id/" });
    const navigate = useNavigate();
    const { user } = useAuth();
    const { template, isLoading, error, mutate } = useTemplate(id);
    const { tree, isLoading: treeLoading } = useTemplateTree(id);
    const [score, setScore] = useState(0);
    const [using, setUsing] = useState(false);

    if (isLoading) {
        return (
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-10 flex justify-center">
                <Loader2 className="size-6 text-foreground/30 animate-spin" />
            </div>
        );
    }
    if (error || !template) {
        return (
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
                <EmptyState icon={LayoutTemplate} title="模板不存在" />
            </div>
        );
    }

    const isAuthor = !!user && user.id === template.authorId;

    const handleUse = async () => {
        if (!user) {
            navigate({
                to: "/auth",
                search: {
                    mode: "login",
                    redirect: `/templates/${id}`,
                },
            });
            return;
        }
        setUsing(true);
        try {
            const result = await applyTemplate(template.id);
            toast.success("已基于模板创建草稿");
            navigate({ to: "/work/$id/edit", params: { id: result.id } });
        } catch (rateError) {
            toast.danger((rateError as Error).message);
        } finally {
            setUsing(false);
        }
    };

    const handleRate = async (value: number) => {
        if (!user) {
            navigate({
                to: "/auth",
                search: {
                    mode: "login",
                    redirect: `/templates/${id}`,
                },
            });
            return;
        }
        setScore(value);
        try {
            await rateTemplate(template.id, value);
            await mutate();
            toast.success("感谢评分");
        } catch (rateError) {
            toast.danger((rateError as Error).message);
        }
    };

    return (
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
            <div className="rounded-2xl border border-default-200/70 overflow-hidden">
                <div className="relative h-44 bg-gradient-to-br from-primary/20 via-secondary/10 to-primary/5">
                    {template.coverUrl ? (
                        <img
                            src={template.coverUrl}
                            alt={template.title}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <LayoutTemplate className="size-10 text-primary/40" />
                        </div>
                    )}
                    <Chip
                        variant="soft"
                        className="absolute top-3 left-3 bg-background/80 backdrop-blur-sm"
                    >
                        {templateCategoryLabel(template.category)}
                    </Chip>
                </div>

                <div className="p-5 sm:p-6 flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex flex-col gap-2 min-w-0">
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                                {template.title}
                            </h1>
                            <div className="flex items-center gap-2 text-sm text-foreground/55 flex-wrap">
                                {template.authorId ? (
                                    <Link
                                        to="/user/$id"
                                        params={{ id: template.authorId }}
                                        className="flex items-center gap-1.5 hover:underline"
                                    >
                                        {template.authorImage ? (
                                            <Avatar size="sm">
                                                <Avatar.Image
                                                    src={template.authorImage}
                                                    alt={
                                                        template.authorName ??
                                                        "作者"
                                                    }
                                                />
                                                <Avatar.Fallback>
                                                    {template.authorName
                                                        ?.charAt(0)
                                                        ?.toUpperCase() ?? "?"}
                                                </Avatar.Fallback>
                                            </Avatar>
                                        ) : null}
                                        {template.authorName ?? "官方模板"}
                                    </Link>
                                ) : (
                                    <span className="flex items-center gap-1.5">
                                        <Boxes className="size-3.5" />
                                        官方模板
                                    </span>
                                )}
                                <span className="text-foreground/25">·</span>
                                <span className="flex items-center gap-1">
                                    <CalendarDays className="size-3.5" />
                                    {formatDate(template.createdAt)}
                                </span>
                                <span className="text-foreground/25">·</span>
                                <span>{template.fileCount} 个文件</span>
                                <span className="text-foreground/25">·</span>
                                <span>
                                    {formatCount(template.useCount)} 次使用
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <StarRating
                                    rating={template.rating}
                                    interactive={!isAuthor}
                                    value={score}
                                    onRate={handleRate}
                                />
                                {template.ratingCount > 0 && (
                                    <span className="text-xs text-foreground/40">
                                        {template.ratingCount} 人评分
                                    </span>
                                )}
                            </div>
                        </div>

                        <Button
                            variant="primary"
                            size="lg"
                            className="gap-2 shrink-0"
                            isDisabled={using}
                            onPress={handleUse}
                        >
                            {using ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <LayoutTemplate className="size-4" />
                            )}
                            使用此模板创作
                        </Button>
                    </div>

                    {template.description && (
                        <p className="text-[15px] leading-relaxed text-foreground/75 whitespace-pre-wrap">
                            {template.description}
                        </p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
                <div className="flex flex-col gap-6 min-w-0">
                    <div className="rounded-2xl border border-default-200/70 p-5 flex flex-col gap-3">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                            <Sparkles className="size-4 text-primary" />
                            创作脉络
                        </div>
                        <TemplateUseTree
                            uses={tree.derived}
                            isLoading={treeLoading}
                        />
                    </div>

                    {isAuthor && (
                        <div className="rounded-2xl border border-default-200/70 p-5 flex flex-col gap-3">
                            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                <Boxes className="size-4 text-primary" />
                                使用数据面板
                            </div>
                            <TemplateStatsPanel
                                templateId={template.id}
                                authorId={template.authorId ?? ""}
                            />
                        </div>
                    )}
                </div>

                <aside className="hidden lg:block sticky top-20 rounded-2xl border border-default-200/70 p-4">
                    <TemplateLeaderboard />
                </aside>
            </div>
        </div>
    );
}
