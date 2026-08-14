import { Button, Chip, Spinner } from "@heroui/react";
import {
    Code2,
    Eye,
    GitFork,
    MessageSquare,
    Play,
    Sparkles,
} from "lucide-react";
import { BookmarkButton } from "~/components/bookmarks/BookmarkButton";
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
    onRun: () => void;
    onSpark: () => void;
    onRemix: () => void;
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
 * @param props.onRun - 运行作品。
 * @param props.onSpark - 送火花。
 * @param props.onRemix - 二创。
 * @remarks 提供 运行 / 送火花 / 二创 操作。
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
    onRun,
    onSpark,
    onRemix,
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
                    className="gap-2 shrink-0 shadow-sm"
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
                <BookmarkButton workId={workId} />
            </div>
        </div>
    );
}
