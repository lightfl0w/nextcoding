import { Button, Card, Chip, toast } from "@heroui/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Code, FileText, Gamepad2, Layout, Wrench } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "~/components/ui/EmptyState";
import { PageHeader } from "~/components/ui/PageHeader";
import { useAuth } from "~/hooks/useAuth";
import { useTemplates } from "~/hooks/useTemplates";
import type { Template } from "~/lib/api/templates";
import { applyTemplate } from "~/lib/api/templates";
import { formatCount } from "~/lib/format";

export const Route = createFileRoute("/templates")({
    component: TemplatesPage,
});

const CATEGORIES = [
    { id: undefined, label: "全部", icon: Layout },
    { id: "basic", label: "基础", icon: FileText },
    { id: "web", label: "网页", icon: Code },
    { id: "algorithm", label: "算法", icon: Code },
    { id: "game", label: "游戏", icon: Gamepad2 },
    { id: "tool", label: "工具", icon: Wrench },
] as const;

const SKELETON_KEYS = Array.from(
    { length: 6 },
    (_, i) => `template-skeleton-${i + 1}`,
);

function TemplatesPage() {
    const [category, setCategory] = useState<string | undefined>();
    const { templates, isLoading } = useTemplates(category);
    const { isLoggedIn } = useAuth();
    const navigate = useNavigate();

    const handleUseTemplate = async (templateId: string) => {
        if (!isLoggedIn) {
            toast.warning("请先登录");
            return;
        }
        try {
            const result = await applyTemplate(templateId);
            navigate({ to: "/work/$id/edit", params: { id: result.id } });
        } catch {
            toast.danger("使用模板失败");
        }
    };

    return (
        <div className="mx-auto w-full max-w-7xl p-8 flex flex-col gap-6">
            <PageHeader
                title="作品模板"
                description="从模板开始创建作品，快速上手"
            />

            <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                    <Button
                        key={cat.id ?? "all"}
                        size="sm"
                        variant={category === cat.id ? "primary" : "ghost"}
                        onPress={() => setCategory(cat.id)}
                        className="gap-1.5"
                    >
                        <cat.icon className="size-3.5" />
                        {cat.label}
                    </Button>
                ))}
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {SKELETON_KEYS.map((key) => (
                        <div
                            key={key}
                            className="rounded-2xl border border-default-200/70 h-40 animate-pulse bg-default-100/50"
                        />
                    ))}
                </div>
            ) : templates.length === 0 ? (
                <EmptyState icon={FileText} title="暂无模板" />
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
    );
}

function TemplateCard({
    template,
    onUse,
}: {
    template: Template;
    onUse: (id: string) => void;
}) {
    return (
        <Card className="p-0 shadow-none rounded-2xl border border-default-200/70 hover:border-default-300 transition-colors">
            <Card.Content className="p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1 min-w-0">
                        <h3 className="text-base font-semibold truncate">
                            {template.title}
                        </h3>
                        {template.description && (
                            <p className="text-sm text-foreground/60 line-clamp-2">
                                {template.description}
                            </p>
                        )}
                    </div>
                    {template.category && (
                        <Chip size="sm" variant="soft">
                            {template.category}
                        </Chip>
                    )}
                </div>

                <div className="flex items-center justify-between text-xs text-foreground/45">
                    <span>{template.fileCount} 个文件</span>
                    <span>{formatCount(template.useCount)} 次使用</span>
                </div>

                <Button
                    size="sm"
                    variant="primary"
                    fullWidth
                    onPress={() => onUse(template.id)}
                >
                    使用此模板
                </Button>
            </Card.Content>
        </Card>
    );
}
