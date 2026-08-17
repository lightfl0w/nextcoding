import { Button, Chip, Spinner } from "@heroui/react";
import { History, Play } from "lucide-react";
import type { WorkVersion } from "~/lib/api";
import { formatDate } from "~/lib/format";

interface VersionTimelineProps {
    versions: WorkVersion[];
    runningVersion: number | null;
    isRunning: boolean;
    onRun: (version: WorkVersion) => void;
}

/**
 * 版本时间线。
 * @param props.versions - 版本列表。
 * @param props.runningVersion - 运行中的版本号。
 * @param props.isRunning - 是否运行中。
 * @param props.onRun - 点击运行某版本。
 * @remarks 可点击运行历史版本。
 */
export function VersionTimeline({
    versions,
    runningVersion,
    isRunning,
    onRun,
}: VersionTimelineProps) {
    if (versions.length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 py-6 text-foreground/40">
                <History className="size-5" strokeWidth={1.5} />
                <p className="text-sm">暂无版本记录</p>
            </div>
        );
    }

    return (
        <ul className="flex flex-col gap-1">
            {versions.map((version) => {
                const isActive = runningVersion === version.version;
                return (
                    <li
                        key={version.version}
                        className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-hover transition-colors"
                    >
                        <Chip
                            size="sm"
                            variant={isActive ? "primary" : "soft"}
                            className="font-mono shrink-0"
                        >
                            v{version.version}
                        </Chip>
                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <span className="text-sm text-foreground/80 truncate">
                                {version.message ?? "无说明"}
                            </span>
                            <span className="text-xs text-foreground/40">
                                {formatDate(version.createdAt)}
                            </span>
                        </div>
                        <Button
                            size="sm"
                            variant="ghost"
                            isIconOnly
                            aria-label={`运行 v${version.version}`}
                            isDisabled={isRunning}
                            onPress={() => onRun(version)}
                            className="size-7 min-w-0 shrink-0 opacity-60 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                        >
                            {isActive && isRunning ? (
                                <Spinner size="sm" />
                            ) : (
                                <Play className="size-3.5" />
                            )}
                        </Button>
                    </li>
                );
            })}
        </ul>
    );
}
