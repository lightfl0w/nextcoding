import { X } from "lucide-react";
import { useMemo } from "react";
import type { WorkFile } from "~/lib/api";
import { pathBasename } from "~/lib/fileTree";

interface EditorTabsProps {
    files: WorkFile[];
    activeKey: string | null;
    dirtyKeys: ReadonlySet<string>;
    onSelect: (key: string) => void;
    onClose: (key: string) => void;
}

export function EditorTabs({
    files,
    activeKey,
    dirtyKeys,
    onSelect,
    onClose,
}: EditorTabsProps) {
    const duplicateBasenames = useMemo(
        () => collectDuplicateBasenames(files),
        [files],
    );
    return (
        <div className="flex items-center gap-1 border-b border-default-200 px-2 h-9 overflow-x-auto shrink-0">
            {files.map((file) => {
                const isActive = activeKey === file.key;
                const basename = pathBasename(file.name);
                const label = duplicateBasenames.has(basename)
                    ? file.name
                    : basename;
                return (
                    <div
                        key={file.key}
                        className={`group flex items-center h-full text-xs whitespace-nowrap border-b-2 ${
                            isActive
                                ? "border-primary text-foreground"
                                : "border-transparent text-foreground/60 hover:text-foreground"
                        }`}
                    >
                        <button
                            type="button"
                            onClick={() => onSelect(file.key)}
                            title={file.name}
                            className="flex items-center gap-1.5 pl-3 pr-1 h-full"
                        >
                            {label}
                            {dirtyKeys.has(file.key) && (
                                <span className="size-1.5 rounded-full bg-warning" />
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => onClose(file.key)}
                            aria-label={`关闭 ${file.name}`}
                            className={`p-1 mr-1.5 rounded-md text-foreground/40 hover:bg-default-200 hover:text-foreground transition-opacity ${
                                isActive
                                    ? "opacity-100"
                                    : "opacity-0 group-hover:opacity-100"
                            }`}
                        >
                            <X className="size-3" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

function collectDuplicateBasenames(files: WorkFile[]): Set<string> {
    const counts = new Map<string, number>();
    for (const file of files) {
        const basename = pathBasename(file.name);
        counts.set(basename, (counts.get(basename) ?? 0) + 1);
    }
    const duplicates = new Set<string>();
    for (const [basename, count] of counts) {
        if (count > 1) duplicates.add(basename);
    }
    return duplicates;
}
