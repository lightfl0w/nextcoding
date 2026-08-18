import { Button, Chip, Spinner } from "@heroui/react";
import { Terminal } from "@wterm/react";
import type { RunResult } from "clientbox";
import {
    Eraser,
    Gamepad2,
    Info,
    Square,
    Terminal as TerminalIcon,
    X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { memo } from "react";
import "@wterm/dom/css";

import "~/assets/pyscript-xterm.css";

import type { OutputLine, RunMode } from "~/hooks/useCodeRunner";
import { useTerminalSession } from "~/hooks/useTerminalSession";

/**
 * 运行输出终端。
 * @param props.open - 是否展开。
 * @param props.running - 是否运行中。
 * @param props.output - 输出行（仅 clientbox 模式使用）。
 * @param props.result - 运行结果。
 * @param props.label - 附加标签。
 * @param props.onClose - 关闭面板。
 * @param props.onClear - 清空输出。
 * @param props.className - 附加类名。
 * @param props.awaitingInput - 程序是否在等待输入。
 * @param props.onSubmitInput - 提交一行输入。
 * @param props.onCancelInput - 结束输入（EOF）。
 * @param props.mode - 渲染模式：clientbox 用 wterm，python 用 PyScript xterm，pygame 显示画布。
 * @param props.terminalId - PyScript xterm 挂载容器 id。
 * @param props.canvasId - pygame 画布 id。
 * @param props.onStop - 停止 pygame 游戏。
 * @param props.placement - 面板方位：`bottom` 为底部横条（详情页），
 * `right` 为右侧竖栏（编辑器，VSCode 风格）。
 * @remarks clientbox 模式基于 wterm 渲染，stderr 标红；Python 输出由
 * PyScript 终端直接渲染，`input()` 在终端内联完成。
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
    mode,
    terminalId,
    canvasId,
    onStop,
    loadStage,
    loopHint,
    placement = "bottom",
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
    mode: RunMode;
    terminalId: string;
    canvasId: string;
    onStop: () => void;
    loadStage: string | null;
    loopHint: boolean;
    placement?: "bottom" | "right";
}) {
    const { resolvedTheme } = useTheme();
    const terminal = useTerminalSession({
        output,
        awaitingInput,
        onSubmitInput,
        onCancelInput,
        onClear,
    });

    if (!open) {
        return null;
    }

    const panelClassName =
        placement === "right"
            ? "w-1/2 shrink-0 border-l border-default-200 flex flex-col bg-surface"
            : "h-52 shrink-0 border-t border-default-200 flex flex-col bg-surface";

    return (
        <div className={`${panelClassName} ${className ?? ""}`}>
            <RunPanelHeader
                running={running}
                awaitingInput={awaitingInput}
                label={label}
                result={result}
                mode={mode}
                loadStage={loadStage}
                onClear={terminal.handleClear}
                onClose={onClose}
                onStop={onStop}
            />
            {mode === "clientbox" && (
                <Terminal
                    ref={terminal.termRef}
                    theme={resolvedTheme === "dark" ? "monokai" : "light"}
                    autoResize
                    cursorBlink
                    onData={terminal.handleData}
                    onReady={terminal.handleReady}
                    className="flex-1 min-h-0 w-full"
                />
            )}
            {mode === "python" && (
                <div
                    id={terminalId}
                    className="flex-1 min-h-0 w-full bg-[#191A19]"
                />
            )}
            {mode === "pygame" && (
                <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 p-3 overflow-auto">
                    <span className="flex items-center gap-1.5 text-xs text-foreground/50">
                        <Gamepad2 className="size-3.5" />
                        图形输出
                    </span>
                    <canvas
                        id={canvasId}
                        width={320}
                        height={240}
                        tabIndex={0}
                        className="max-w-full border border-default-200 rounded-lg bg-black outline-none focus:border-primary"
                        style={{ imageRendering: "pixelated" }}
                    />
                    {loopHint && (
                        <p className="flex items-center gap-1.5 text-xs text-warning px-2 text-center leading-relaxed">
                            <Info className="size-3.5 shrink-0" />
                            游戏循环未让出主线程，页面会卡顿——建议在循环内加
                            await asyncio.sleep(1/60)
                        </p>
                    )}
                    {running && (
                        <span className="flex items-center gap-1.5 text-xs text-foreground/60">
                            <Spinner size="sm" />
                            {loadStage ?? "正在加载 Pygame…"}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
});

/**
 * 运行面板工具栏。
 * @param props.running - 是否运行中。
 * @param props.awaitingInput - 程序是否在等待输入。
 * @param props.label - 附加标签。
 * @param props.result - 运行结果。
 * @param props.mode - 渲染模式。
 * @param props.onClear - 清空输出。
 * @param props.onClose - 关闭面板。
 * @param props.onStop - 停止 pygame 游戏。
 */
function RunPanelHeader({
    running,
    awaitingInput,
    label,
    result,
    mode,
    loadStage,
    onClear,
    onClose,
    onStop,
}: {
    running: boolean;
    awaitingInput: boolean;
    label: string | null;
    result: RunResult | null;
    mode: RunMode;
    loadStage: string | null;
    onClear: () => void;
    onClose: () => void;
    onStop: () => void;
}) {
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 min-h-9 border-b border-default-200 shrink-0 bg-default-50 flex-wrap">
            <TerminalIcon className="size-3.5 text-foreground/50" />
            <span className="text-xs font-medium text-foreground/70">输出</span>
            {running && (
                <span className="flex items-center gap-1.5 text-xs text-foreground/60">
                    <Spinner size="sm" />
                    运行中…
                </span>
            )}
            {loadStage && (
                <span className="text-xs text-foreground/50">{loadStage}</span>
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
            {mode === "pygame" && running && (
                <Button
                    size="sm"
                    variant="danger"
                    className="gap-1 h-7 min-w-0 px-2"
                    onPress={onStop}
                    aria-label="停止运行"
                >
                    <Square className="size-3" />
                    停止
                </Button>
            )}
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
