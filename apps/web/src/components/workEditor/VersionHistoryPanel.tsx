import { Button } from "@heroui/react";
import { GitCompareArrows, RotateCcw } from "lucide-react";
import { memo } from "react";
import type { WorkVersion } from "~/lib/api";
import { ConfirmButton } from "./ConfirmButton";

interface VersionHistoryPanelProps {
    versions: WorkVersion[];
    onCompare: (version: number) => void;
    onRestore: (version: number) => void;
}

export const VersionHistoryPanel = memo(function VersionHistoryPanel({
    versions,
    onCompare,
    onRestore,
}: VersionHistoryPanelProps) {
    return (
        <aside className="w-64 border-l border-default-200 overflow-y-auto p-3 flex flex-col gap-2 shrink-0">
            <div className="text-xs font-medium text-foreground/60">
                版本历史
            </div>

            {versions.length === 0 ? (
                <p className="text-xs text-foreground/40">
                    还没有版本，点右上角「发布版本」
                </p>
            ) : (
                versions.map((version) => (
                    <VersionRow
                        key={version.version}
                        version={version}
                        onCompare={() => onCompare(version.version)}
                        onRestore={() => onRestore(version.version)}
                    />
                ))
            )}
        </aside>
    );
});

function VersionRow({
    version,
    onCompare,
    onRestore,
}: {
    version: WorkVersion;
    onCompare: () => void;
    onRestore: () => void;
}) {
    return (
        <div className="rounded-lg border border-default-200 p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium">v{version.version}</span>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        title="对比当前草稿"
                        onClick={onCompare}
                        className="p-1 rounded-md hover:bg-default-100 text-foreground/60"
                    >
                        <GitCompareArrows className="size-3.5" />
                    </button>
                    <ConfirmButton
                        heading={`回滚到 v${version.version}？`}
                        description={`将用 v${version.version} 的内容覆盖当前草稿，当前未发布的修改会丢失。历史版本不会被删除。`}
                        confirmLabel="确认回滚"
                        onConfirm={onRestore}
                        trigger={
                            <Button
                                size="sm"
                                variant="ghost"
                                isIconOnly
                                aria-label={`回滚到 v${version.version}`}
                            >
                                <RotateCcw className="size-3.5" />
                            </Button>
                        }
                    />
                </div>
            </div>
            <span className="text-xs text-foreground/60 truncate">
                {version.message ?? "无说明"}
            </span>
        </div>
    );
}
