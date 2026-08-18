import { Avatar, Card } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import {
    Award,
    Boxes,
    Heart,
    Loader2,
    MessageSquare,
    Sparkles,
} from "lucide-react";
import { memo } from "react";
import { AchievementBadge } from "~/components/achievements/AchievementBadge";
import { useTemplateStats } from "~/hooks/useTemplateStats";
import { useUserAchievements } from "~/hooks/useUserAchievements";
import { formatCount, formatDate } from "~/lib/format";

/**
 * 模板使用数据面板（模板作者专属）。
 * @param props.templateId - 模板 ID。
 * @param props.authorId - 模板作者 ID。
 * @remarks 展示使用记录、派生作品互动汇总与模板成就徽章。
 */
export const TemplateStatsPanel = memo(function TemplateStatsPanel({
    templateId,
    authorId,
}: {
    templateId: string;
    authorId: string;
}) {
    const { stats, isLoading } = useTemplateStats(templateId);
    const { achievements } = useUserAchievements(authorId);
    const templateAchievements = achievements.filter(
        (achievement) => achievement.category === "template",
    );

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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {statCards.map((item) => (
                    <div
                        key={item.label}
                        className="rounded-xl border border-default-200/70 p-3 flex flex-col gap-1"
                    >
                        <span className="flex items-center gap-1.5 text-xs text-foreground/45">
                            <item.icon className="size-3.5" />
                            {item.label}
                        </span>
                        <span className="text-lg font-semibold text-foreground">
                            {formatCount(item.value)}
                        </span>
                    </div>
                ))}
            </div>

            {templateAchievements.length > 0 && (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <Award className="size-4 text-primary" />
                        已解锁成就
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {templateAchievements.map((achievement) => (
                            <AchievementBadge
                                key={achievement.id}
                                achievement={achievement}
                                unlocked
                            />
                        ))}
                    </div>
                </div>
            )}

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

            <Card className="p-0 shadow-none rounded-2xl border border-primary/25 bg-primary/5">
                <Card.Content className="p-4 flex items-start gap-2">
                    <Award className="size-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-xs text-foreground/60 leading-relaxed">
                        使用次数达标可解锁专属成就：发布第 1
                        个模板解锁「模板先锋」； 单个模板被使用 100
                        次解锁「万人师表」； 拥有 5 个模板且总使用量超 1000
                        次解锁「模板大师」。
                    </p>
                </Card.Content>
            </Card>
        </div>
    );
});
