import { Button, Chip, Spinner } from "@heroui/react";
import { Terminal, type TerminalHandle } from "@wterm/react";
import type { RunResult } from "clientbox";
import { Eraser, Terminal as TerminalIcon, X } from "lucide-react";
import { useTheme } from "next-themes";
import { memo, useCallback, useEffect, useRef } from "react";
import "@wterm/dom/css";

import type { OutputLine } from "~/hooks/useCodeRunner";
import { formatOutputLines } from "~/lib/run";

/**
 * 运行输出终端。
 * @param props.open - 是否展开。
 * @param props.running - 是否运行中。
 * @param props.output - 输出行。
 * @param props.result - 运行结果。
 * @param props.label - 附加标签。
 * @param props.onClose - 关闭面板。
 * @param props.onClear - 清空输出。
 * @param props.className - 附加类名。
 * @param props.awaitingInput - 程序是否在等待输入。
 * @param props.onSubmitInput - 提交一行输入。
 * @param props.onCancelInput - 结束输入（EOF）。
 * @remarks 基于 wterm 渲染，stderr 标红；程序 `input()` 时终端回显输入并回车提交。
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
    awaitingInput,
    onSubmitInput,
    onCancelInput,
}: {
    open: boolean;
    running: boolean;
    output: OutputLine[];
    result: RunResult | null;
    label: string | null;
    onClose: () => void;
    onClear: () => void;
    className?: string;
    awaitingInput: boolean;
    onSubmitInput: (value: string) => void;
    onCancelInput: () => void;
}) {
    const { resolvedTheme } = useTheme();
    const termRef = useRef<TerminalHandle>(null);
    const lineBufferRef = useRef("");
    const writtenCountRef = useRef(0);
    const outputRef = useRef(output);
    outputRef.current = output;
    const awaitingRef = useRef(awaitingInput);
    awaitingRef.current = awaitingInput;
    const submitInputRef = useRef(onSubmitInput);
    submitInputRef.current = onSubmitInput;
    const cancelInputRef = useRef(onCancelInput);
    cancelInputRef.current = onCancelInput;

    const writeOutput = useCallback((lines: OutputLine[]) => {
        const term = termRef.current;
        if (!term || lines.length === 0) {
            return;
        }
        term.write(formatOutputLines(lines));
    }, []);

    useEffect(() => {
        const term = termRef.current;
        if (!term) {
            return;
        }
        if (output.length === 0) {
            if (writtenCountRef.current !== 0) {
                writtenCountRef.current = 0;
                term.write("\x1b[2J\x1b[3J\x1b[H");
            }
            return;
        }
        const pending = output.slice(writtenCountRef.current);
        writtenCountRef.current = output.length;
        writeOutput(pending);
    }, [output, writeOutput]);

    const handleReady = useCallback(() => {
        const lines = outputRef.current;
        if (lines.length > 0) {
            writeOutput(lines);
        }
        writtenCountRef.current = lines.length;
    }, [writeOutput]);

    const handleData = useCallback((data: string) => {
        if (!awaitingRef.current) {
            return;
        }
        const term = termRef.current;
        for (const ch of data) {
            if (ch === "\r") {
                const line = lineBufferRef.current;
                lineBufferRef.current = "";
                term?.write("\r\n");
                submitInputRef.current(line);
            } else if (ch === "\x7f") {
                if (lineBufferRef.current.length > 0) {
                    lineBufferRef.current = lineBufferRef.current.slice(0, -1);
                    term?.write("\b \b");
                }
            } else if (ch === "\x1b") {
                lineBufferRef.current = "";
                cancelInputRef.current();
            } else if (ch >= " ") {
                lineBufferRef.current += ch;
                term?.write(ch);
            }
        }
    }, []);

    useEffect(() => {
        if (awaitingInput) {
            termRef.current?.focus();
        }
    }, [awaitingInput]);

    const handleClear = useCallback(() => {
        writtenCountRef.current = 0;
        termRef.current?.write("\x1b[2J\x1b[3J\x1b[H");
        onClear();
    }, [onClear]);

    if (!open) {
        return null;
    }

    return (
        <div
            className={`h-52 shrink-0 border-t border-default-200 flex flex-col bg-surface ${className ?? ""}`}
        >
            <RunPanelHeader
                running={running}
                awaitingInput={awaitingInput}
                label={label}
                result={result}
                onClear={handleClear}
                onClose={onClose}
            />
            <Terminal
                ref={termRef}
                theme={resolvedTheme === "dark" ? "monokai" : "light"}
                autoResize
                cursorBlink
                onData={handleData}
                onReady={handleReady}
                className="flex-1 min-h-0 w-full"
            />
        </div>
    );
});

/**
 * 运行面板工具栏。
 * @param props.running - 是否运行中。
 * @param props.awaitingInput - 程序是否在等待输入。
 * @param props.label - 附加标签。
 * @param props.result - 运行结果。
 * @param props.onClear - 清空输出。
 * @param props.onClose - 关闭面板。
 */
function RunPanelHeader({
    running,
    awaitingInput,
    label,
    result,
    onClear,
    onClose,
}: {
    running: boolean;
    awaitingInput: boolean;
    label: string | null;
    result: RunResult | null;
    onClear: () => void;
    onClose: () => void;
}) {
    return (
        <div className="flex items-center gap-2 px-3 h-9 border-b border-default-200 shrink-0 bg-default-50">
            <TerminalIcon className="size-3.5 text-foreground/50" />
            <span className="text-xs font-medium text-foreground/70">输出</span>
            {running && (
                <span className="flex items-center gap-1.5 text-xs text-foreground/60">
                    <Spinner size="sm" />
                    运行中…
                </span>
            )}
            {awaitingInput && (
                <Chip size="sm" variant="soft">
                    等待输入…
                </Chip>
            )}
            {label && (
                <Chip size="sm" variant="soft">
                    {label}
                </Chip>
            )}
            {result && (
                <div className="flex items-center gap-1.5 text-xs">
                    <Chip
                        size="sm"
                        variant="soft"
                        color={result.exitCode === 0 ? "success" : "danger"}
                    >
                        退出码 {result.exitCode}
                    </Chip>
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
    );
}
