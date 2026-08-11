import { Button, Chip, Spinner } from "@heroui/react";
import {
    Code2,
    Eye,
    GitFork,
    MessageSquare,
    Play,
    Sparkles,
} from "lucide-react";
import { formatCount } from "~/lib/format";
import { languageLabel, type RuntimeInfo } from "~/lib/run";
import { StatBadge } from "./StatBadge";

interface WorkActionsProps {
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

export function WorkActions({
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
                    {sparked ? "已送出火花" : "送火花"}
                </Button>
                <Button
                    variant="outline"
                    className="gap-2 shrink-0"
                    onPress={onRemix}
                >
                    <GitFork className="size-4" />
                    二创
                </Button>
            </div>
        </div>
    );
}
