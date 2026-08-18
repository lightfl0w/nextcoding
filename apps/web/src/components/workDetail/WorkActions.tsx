import { Button, Chip, Spinner } from "@heroui/react";
import {
    Code2,
    Eye,
    GitFork,
    LayoutTemplate,
    MessageSquare,
    Play,
    Sparkles,
} from "lucide-react";
import { BookmarkButton } from "~/components/bookmarks/BookmarkButton";
import { ReportButton } from "~/components/ReportButton";
import { formatCount } from "~/lib/format";
import { languageLabel, type RuntimeInfo } from "~/lib/run";
import { StatBadge } from "./StatBadge";

interface WorkActionsProps {
    workId: string;
    views: number;
    sparks: number;
    commentCount: number;
    runtime: RuntimeInfo | null;
    isOwner: boolean;
    isRunning: boolean;
    sparked: boolean;
    isTemplate: boolean;
    templateUseCount: number;
    isUsingTemplate: boolean;
    onRun: () => void;
    onSpark: () => void;
    onRemix: () => void;
    onUseTemplate: () => void;
}

/**
 * 详情页统计与操作区。
 * @param props.views - 浏览数。
 * @param props.sparks - 火花数。
 * @param props.commentCount - 评论数。
 * @param props.runtime - 运行环境。
 * @param props.isOwner - 是否本人作品。
 * @param props.isRunning - 是否运行中。
 * @param props.sparked - 是否已送火花。
 * @param props.isTemplate - 是否开放为模板。
 * @param props.templateUseCount - 被用作模板次数。
 * @param props.isUsingTemplate - 使用模板请求进行中。
 * @param props.onRun - 运行作品。
 * @param props.onSpark - 送火花。
 * @param props.onRemix - 二创。
 * @param props.onUseTemplate - 使用此模板创作。
 * @remarks 提供 运行 / 送火花 / 二创 / 使用模板 操作。
 */
export function WorkActions({
    workId,
    views,
    sparks,
    commentCount,
    runtime,
    isOwner,
    isRunning,
    sparked,
    isTemplate,
    templateUseCount,
    isUsingTemplate,
    onRun,
    onSpark,
    onRemix,
    onUseTemplate,
}: WorkActionsProps) {
    return (
        <div className="flex flex-col gap-4 px-1">
            <div className="flex items-center gap-5 sm:gap-6 text-sm text-foreground/60 flex-wrap">
                <StatBadge
                    icon={Eye}
                    value={formatCount(views)}
                    label="次浏览"
                />
                <StatBadge
                    icon={Sparkles}
                    value={formatCount(sparks)}
                    label="个火花"
                />
                <StatBadge
                    icon={MessageSquare}
                    value={formatCount(commentCount)}
                    label="条评论"
                />
                {isTemplate && (
                    <StatBadge
                        icon={LayoutTemplate}
                        value={formatCount(templateUseCount)}
                        label="次被用作模板"
                    />
                )}
                {runtime && (
                    <Chip size="sm" variant="soft" className="gap-1">
                        <Code2 className="size-3" />
                        {languageLabel(runtime.language)}
                    </Chip>
                )}
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
                <Button
                    variant="primary"
                    className="gap-2 shrink-0"
                    isDisabled={!runtime || isRunning}
                    onPress={onRun}
                >
                    {isRunning ? (
                        <Spinner size="sm" color="current" />
                    ) : (
                        <Play className="size-4" fill="currentColor" />
                    )}
                    运行作品
                </Button>
                <Button
                    variant={sparked ? "primary" : "secondary"}
                    className="gap-2 shrink-0"
                    isDisabled={isOwner}
                    onPress={onSpark}
                >
                    <Sparkles
                        className="size-4"
                        fill={sparked ? "currentColor" : "none"}
                    />
                    火花
                </Button>
                <Button
                    variant="outline"
                    className="gap-2 shrink-0"
                    onPress={onRemix}
                >
                    <GitFork className="size-4" />
                    二创
                </Button>
                {isTemplate && !isOwner && (
                    <Button
                        variant="secondary"
                        className="gap-2 shrink-0"
                        isDisabled={isUsingTemplate}
                        onPress={onUseTemplate}
                    >
                        {isUsingTemplate ? (
                            <Spinner size="sm" color="current" />
                        ) : (
                            <LayoutTemplate className="size-4" />
                        )}
                        使用此模板创作
                    </Button>
                )}
                <BookmarkButton workId={workId} />
                <ReportButton workId={workId} />
            </div>
        </div>
    );
}
