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
    Eye,
    FileCode2,
    FileText,
    Hash,
    LayoutTemplate,
    Loader2,
    MessageSquare,
    Sparkles,
    Star,
    Undo2,
    User,
} from "lucide-react";
import { useState } from "react";
import { StarRating } from "~/components/templates/StarRating";
import { TemplateLeaderboard } from "~/components/templates/TemplateLeaderboard";
import { TemplateStatsPanel } from "~/components/templates/TemplateStatsPanel";
import { TemplateUseTree } from "~/components/templates/TemplateUseTree";
import { EmptyState } from "~/components/ui/EmptyState";
import { CommentsSection } from "~/components/workDetail/CommentsSection";
import { SectionCard } from "~/components/workDetail/SectionCard";
import { StatBadge } from "~/components/workDetail/StatBadge";
import { useAuth } from "~/hooks/useAuth";
import { useFocusedComment } from "~/hooks/useFocusedComment";
import { useTemplate } from "~/hooks/useTemplate";
import { useTemplateComments } from "~/hooks/useTemplateComments";
import { useTemplateTree } from "~/hooks/useTemplateTree";
import {
    applyTemplate,
    postTemplateComment,
    rateTemplate,
} from "~/lib/api/templates";
import { formatCount, formatDate } from "~/lib/format";
import { templateCategoryLabel } from "~/lib/templateCategories";

export const Route = createFileRoute("/templates/$id/")({
    validateSearch: (
        search: Record<string, unknown>,
    ): { comment?: string } => ({
        comment:
            typeof search.comment === "string" ? search.comment : undefined,
    }),
    component: TemplateDetailPage,
});

function TemplateDetailPage() {
    const { id } = useParams({ from: "/templates/$id/" });
    const { comment: focusCommentId } = Route.useSearch();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { template, isLoading, error, mutate } = useTemplate(id);
    const { tree, isLoading: treeLoading } = useTemplateTree(id);
    const {
        data: comments,
        isLoading: commentsLoading,
        mutate: mutateComments,
    } = useTemplateComments(id);
    const [score, setScore] = useState(0);
    const [using, setUsing] = useState(false);

    const commentsReady = !commentsLoading && !!comments;
    const { focusedCommentId } = useFocusedComment(
        focusCommentId,
        commentsReady,
    );

    if (isLoading) {
        return (
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-10 py-10 flex justify-center">
                <Loader2 className="size-6 text-foreground/30 animate-spin" />
            </div>
        );
    }
    if (error || !template) {
        return (
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-10 py-10">
                <EmptyState icon={LayoutTemplate} title="模板不存在" />
            </div>
        );
    }

    const isAuthor = !!user && user.id === template.authorId;
    const isPublished = template.status === "published";
    const commentCount = comments?.length ?? 0;

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
        <div className="w-full flex flex-col">
            <header className="sticky top-0 z-30 px-4 sm:px-6 lg:px-10 py-3 border-b border-default-200 bg-background-secondary/30 backdrop-blur-xl flex items-center gap-3 min-w-0">
                <Link
                    to="/templates"
                    title="返回模板市场"
                    className="size-9 -ml-1 rounded-xl flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-hover transition-colors shrink-0"
                >
                    <Undo2 className="size-4" />
                </Link>
                <span className="text-sm font-semibold tracking-tight truncate">
                    {template.title}
                </span>
                <div className="flex-1" />
            </header>

            <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pt-6 lg:pt-8 pb-20 flex flex-col gap-8">
                <div className="relative overflow-hidden">
                    <div className="flex items-start justify-between gap-4">
                        <h1 className="flex-1 min-w-0 text-2xl sm:text-4xl font-bold tracking-tight leading-[1.15] text-foreground text-balance">
                            {template.title}
                        </h1>
                    </div>
                </div>

                <TemplateDetailActions
                    template={{
                        useCount: template.useCount,
                        rating: template.rating,
                        ratingCount: template.ratingCount,
                        fileCount: template.fileCount,
                    }}
                    isPublished={isPublished}
                    isAuthor={isAuthor}
                    commentCount={commentCount}
                    score={score}
                    using={using}
                    onUse={handleUse}
                    onRate={handleRate}
                />

                <div className="relative rounded-2xl overflow-hidden border border-default-200/70 ring-1 ring-inset ring-default-200/60">
                    <div className="relative h-56 sm:h-72">
                        {template.coverUrl ? (
                            <img
                                src={template.coverUrl}
                                alt={template.title}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-default-100/60">
                                <LayoutTemplate className="size-12 text-foreground/30" />
                            </div>
                        )}
                        {template.category && (
                            <Chip
                                variant="soft"
                                className="absolute top-3 left-3 bg-background/80 backdrop-blur-sm"
                            >
                                {templateCategoryLabel(template.category)}
                            </Chip>
                        )}
                        {!isPublished && (
                            <Chip
                                color={
                                    template.status === "pending"
                                        ? "warning"
                                        : "danger"
                                }
                                variant="soft"
                                className="absolute top-3 right-3 bg-background/80 backdrop-blur-sm"
                            >
                                {template.status === "pending"
                                    ? "审核中"
                                    : "已驳回"}
                            </Chip>
                        )}
                    </div>
                </div>

                {Array.isArray(template.tags) && template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 -mt-2">
                        {template.tags.map((tag) => (
                            <Chip
                                key={tag}
                                size="sm"
                                variant="soft"
                                className="gap-1"
                            >
                                <Hash className="size-3 opacity-60" />
                                <Chip.Label>{tag}</Chip.Label>
                            </Chip>
                        ))}
                    </div>
                )}

                {isPublished ? (
                    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
                        <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
                            <CommentsSection
                                comments={comments}
                                isLoading={commentsLoading}
                                mutate={mutateComments}
                                submitComment={(content, parentId) =>
                                    postTemplateComment(id, content, parentId)
                                }
                                focusCommentId={focusedCommentId}
                            />
                        </div>

                        <aside className="w-full lg:w-80 shrink-0 lg:sticky lg:top-20 flex flex-col gap-6">
                            <SectionCard title="作者" icon={User}>
                                <TemplateAuthorBlock template={template} />
                            </SectionCard>

                            {template.description && (
                                <SectionCard title="模板简介" icon={FileText}>
                                    <p className="text-[15px] leading-relaxed text-foreground/80 whitespace-pre-wrap">
                                        {template.description}
                                    </p>
                                </SectionCard>
                            )}

                            <SectionCard title="创作脉络" icon={Sparkles}>
                                <TemplateUseTree
                                    uses={tree.derived}
                                    isLoading={treeLoading}
                                />
                            </SectionCard>

                            {isAuthor && (
                                <SectionCard title="使用数据面板" icon={Boxes}>
                                    <TemplateStatsPanel
                                        templateId={template.id}
                                    />
                                </SectionCard>
                            )}

                            <TemplateLeaderboard />
                        </aside>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-default-200/70 p-5 flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                            {template.status === "pending"
                                ? "审核中"
                                : "未通过审核"}
                        </div>
                        <p className="text-sm text-foreground/60 leading-relaxed">
                            {template.status === "pending"
                                ? "模板已提交，等待管理员审核。审核通过后将自动上架模板市场，供其他用户使用。"
                                : "模板未通过审核，未在模板市场展示。请修改内容后重新创建模板。"}
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}

interface TemplateDetailActionsProps {
    template: {
        useCount: number;
        rating: number;
        ratingCount: number;
        fileCount: number;
    };
    isPublished: boolean;
    isAuthor: boolean;
    commentCount: number;
    score: number;
    using: boolean;
    onUse: () => void;
    onRate: (value: number) => void;
}

/**
 * 模板详情页统计与操作区，版式对齐作品详情页的 WorkActions。
 */
function TemplateDetailActions({
    template,
    isPublished,
    isAuthor,
    commentCount,
    score,
    using,
    onUse,
    onRate,
}: TemplateDetailActionsProps) {
    return (
        <div className="flex flex-col gap-4 px-1">
            <div className="flex items-center gap-5 sm:gap-6 text-sm text-foreground/60 flex-wrap">
                <StatBadge
                    icon={Eye}
                    value={formatCount(template.useCount)}
                    label="次使用"
                />
                <StatBadge
                    icon={MessageSquare}
                    value={formatCount(commentCount)}
                    label="条评论"
                />
                <StatBadge
                    icon={FileCode2}
                    value={formatCount(template.fileCount)}
                    label="个文件"
                />
                {template.ratingCount > 0 && (
                    <StatBadge
                        icon={Star}
                        value={formatCount(template.ratingCount)}
                        label="人评分"
                    />
                )}
            </div>

            {isPublished && (
                <div className="flex items-center gap-3 flex-wrap">
                    <Button
                        variant="primary"
                        className="gap-2 shrink-0"
                        isDisabled={using}
                        onPress={onUse}
                    >
                        {using ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <LayoutTemplate className="size-4" />
                        )}
                        使用此模板创作
                    </Button>
                    <StarRating
                        rating={template.rating}
                        interactive={!isAuthor}
                        value={score}
                        onRate={onRate}
                    />
                </div>
            )}
        </div>
    );
}

/**
 * 作者信息块（侧栏卡片内联），展示头像、昵称与创建时间。
 */
function TemplateAuthorBlock({
    template,
}: {
    template: {
        authorId: string | null;
        authorName: string | null;
        authorImage: string | null;
        createdAt: string;
    };
}) {
    const name = template.authorName ?? "官方模板";
    return (
        <div className="flex items-center gap-3">
            {template.authorImage ? (
                <Avatar size="lg">
                    <Avatar.Image alt={name} src={template.authorImage} />
                    <Avatar.Fallback>
                        {name.charAt(0).toUpperCase()}
                    </Avatar.Fallback>
                </Avatar>
            ) : (
                <span className="size-12 rounded-full bg-default-100 flex items-center justify-center text-foreground/50 shrink-0">
                    <User className="size-5" />
                </span>
            )}
            <div className="flex flex-col min-w-0 gap-0.5">
                {template.authorId ? (
                    <Link
                        to="/user/$id"
                        params={{ id: template.authorId }}
                        className="text-base font-semibold truncate hover:text-primary transition-colors"
                    >
                        {name}
                    </Link>
                ) : (
                    <span className="text-base font-semibold truncate">
                        {name}
                    </span>
                )}
                <span className="text-xs text-foreground/50 flex items-center gap-1">
                    <CalendarDays className="size-3" />
                    {formatDate(template.createdAt)}
                </span>
            </div>
        </div>
    );
}
