import { Button, Chip, Spinner } from "@heroui/react";
import type { RunResult } from "clientbox";
import { Eraser, Terminal, X } from "lucide-react";
import { memo, useEffect, useRef } from "react";

import type { OutputLine } from "~/hooks/useCodeRunner";

const STREAM_STYLE: Record<OutputLine["stream"], string> = {
    stdout: "text-foreground",
    stderr: "text-danger",
};

/**
 * 运行输出面板。
 * @param props.open - 是否展开。
 * @param props.running - 是否运行中。
 * @param props.output - 输出行。
 * @param props.result - 运行结果。
 * @param props.label - 附加标签。
 * @param props.onClose - 关闭面板。
 * @param props.onClear - 清空输出。
 * @param props.className - 附加类名。
 * @remarks 展示 stdout/stderr、退出码与耗时。
 */
export const RunPanel = memo(function RunPanel({
    open,
    running,
    output,
    result,
    label,
    onClose,
    onClear,
    className,
}: {
    open: boolean;
    running: boolean;
    output: OutputLine[];
    result: RunResult | null;
    label: string | null;
    onClose: () => void;
    onClear: () => void;
    className?: string;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open || output.length === 0) {
            return;
        }
        const el = scrollRef.current;
        if (el) {
            el.scrollTop = el.scrollHeight;
        }
    }, [output, open]);

    if (!open) {
        return null;
    }

    return (
        <div
            className={`h-52 shrink-0 border-t border-default-200 flex flex-col bg-surface ${className ?? ""}`}
        >
            <div className="flex items-center gap-2 px-3 h-9 border-b border-default-200 shrink-0 bg-default-50">
                <Terminal className="size-3.5 text-foreground/50" />
                <span className="text-xs font-medium text-foreground/70">
                    输出
                </span>
                {running && (
                    <span className="flex items-center gap-1.5 text-xs text-foreground/60">
                        <Spinner size="sm" />
                        运行中…
                    </span>
                )}
                {label && (
                    <Chip size="sm" variant="soft">
                        {label}
                    </Chip>
                )}
                {result && (
                    <div className="flex items-center gap-1.5 text-xs">
                        {result.exitCode === 0 ? (
                            <Chip size="sm" variant="soft" color="success">
                                退出码 {result.exitCode}
                            </Chip>
                        ) : (
                            <Chip size="sm" variant="soft" color="danger">
                                退出码 {result.exitCode}
                            </Chip>
                        )}
                        <span className="text-foreground/40">
                            {(result.duration / 1000).toFixed(2)}s
                        </span>
                    </div>
                )}
                <div className="flex-1" />
                <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    className="size-7 min-w-0"
                    onPress={onClear}
                    aria-label="清空输出"
                >
                    <Eraser className="size-3.5" />
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    className="size-7 min-w-0"
                    onPress={onClose}
                    aria-label="关闭面板"
                >
                    <X className="size-3.5" />
                </Button>
            </div>
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[12px] leading-5 whitespace-pre-wrap break-words bg-background"
            >
                {output.length === 0 && (
                    <p className="text-foreground/35">
                        {running
                            ? "正在准备运行环境…"
                            : "点击右上角「运行」执行代码，输出将显示在这里"}
                    </p>
                )}
                {output.map((line) => (
                    <div key={line.id} className={STREAM_STYLE[line.stream]}>
                        {line.text}
                    </div>
                ))}
            </div>
        </div>
    );
});
