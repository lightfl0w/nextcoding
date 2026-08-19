import { Button, toast } from "@heroui/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LayoutTemplate, Plus } from "lucide-react";
import { useState } from "react";
import { TemplateCard } from "~/components/templates/TemplateCard";
import { EmptyState } from "~/components/ui/EmptyState";
import { PageHeader } from "~/components/ui/PageHeader";
import { useAuth } from "~/hooks/useAuth";
import { useTemplates } from "~/hooks/useTemplates";
import type { TemplateSort } from "~/lib/api/templates";
import { applyTemplate } from "~/lib/api/templates";
import { TEMPLATE_CATEGORIES } from "~/lib/templateCategories";

export const Route = createFileRoute("/templates/")({
    component: TemplatesPage,
});

const SKELETON_KEYS = Array.from(
    { length: 6 },
    (_, i) => `template-skeleton-${i + 1}`,
);

function TemplatesPage() {
    const [category, setCategory] = useState<string | undefined>();
    const [sort, setSort] = useState<TemplateSort>("hot");
    const { templates, isLoading } = useTemplates(category, sort);
    const { isLoggedIn } = useAuth();
    const navigate = useNavigate();

    const handleUseTemplate = async (templateId: string) => {
        if (!isLoggedIn) {
            navigate({
                to: "/auth",
                search: {
                    mode: "login",
                    redirect: "/templates",
                },
            });
            return;
        }
        try {
            const result = await applyTemplate(templateId);
            toast.success("已基于模板创建草稿");
            navigate({ to: "/work/$id/edit", params: { id: result.id } });
        } catch (error) {
            toast.danger((error as Error).message);
        }
    };

    return (
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
            <PageHeader
                title="模板市场"
                description="从优秀模板一键起步，快速产出你的作品"
                action={
                    <Button
                        variant="primary"
                        className="gap-1.5"
                        onPress={() => navigate({ to: "/templates/new" })}
                    >
                        <Plus className="size-4" />
                        创建模板
                    </Button>
                }
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        variant={category === undefined ? "primary" : "ghost"}
                        onPress={() => setCategory(undefined)}
                    >
                        全部
                    </Button>
                    {TEMPLATE_CATEGORIES.map((item) => (
                        <Button
                            key={item.id}
                            size="sm"
                            variant={category === item.id ? "primary" : "ghost"}
                            onPress={() => setCategory(item.id)}
                        >
                            #{item.label}
                        </Button>
                    ))}
                </div>
                <div className="flex items-center gap-1.5">
                    <Button
                        size="sm"
                        variant={sort === "hot" ? "primary" : "ghost"}
                        onPress={() => setSort("hot")}
                    >
                        热度优先
                    </Button>
                    <Button
                        size="sm"
                        variant={sort === "latest" ? "primary" : "ghost"}
                        onPress={() => setSort("latest")}
                    >
                        最新发布
                    </Button>
                    <Link
                        to="/leaderboard"
                        search={{ type: "templates" }}
                        className="text-sm text-primary hover:underline ml-1"
                    >
                        查看模板热度榜 →
                    </Link>
                </div>
            </div>

            <div className="flex flex-col gap-4 min-w-0">
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {SKELETON_KEYS.map((key) => (
                            <div
                                key={key}
                                className="rounded-2xl border border-default-200/70 h-56 animate-pulse bg-default-100/50"
                            />
                        ))}
                    </div>
                ) : templates.length === 0 ? (
                    <EmptyState
                        icon={LayoutTemplate}
                        title="该分类下暂无模板"
                        hint="换个分类看看，或创建你自己的模板"
                        action={
                            <Button
                                variant="primary"
                                className="gap-1.5"
                                onPress={() =>
                                    navigate({ to: "/templates/new" })
                                }
                            >
                                <Plus className="size-4" />
                                创建模板
                            </Button>
                        }
                    />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {templates.map((template) => (
                            <TemplateCard
                                key={template.id}
                                template={template}
                                onUse={handleUseTemplate}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
