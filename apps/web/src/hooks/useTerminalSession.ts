import type { TerminalHandle } from "@wterm/react";
import { useCallback, useEffect, useRef } from "react";
import type { OutputLine } from "~/hooks/useCodeRunner";
import { formatOutputLines } from "~/lib/run";

const CLEAR_ESCAPE = "\x1b[2J\x1b[3J\x1b[H";

interface TerminalSessionOptions {
    output: OutputLine[];
    awaitingInput: boolean;
    onSubmitInput: (value: string) => void;
    onCancelInput: () => void;
    onClear: () => void;
}

/**
 * 终端会话状态：输出增量写入、按键处理与输入提交。
 * @param options.output - 输出行。
 * @param options.awaitingInput - 程序是否在等待输入。
 * @param options.onSubmitInput - 提交一行输入。
 * @param options.onCancelInput - 结束输入（EOF）。
 * @param options.onClear - 清空输出。
 * @returns 终端 ref 与事件处理函数。
 */
export function useTerminalSession({
    output,
    awaitingInput,
    onSubmitInput,
    onCancelInput,
    onClear,
}: TerminalSessionOptions) {
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
            if (writtenCountRef.current === 0) {
                return;
            }
            writtenCountRef.current = 0;
            term.write(CLEAR_ESCAPE);
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

    const submitLine = useCallback(() => {
        const line = lineBufferRef.current;
        lineBufferRef.current = "";
        termRef.current?.write("\r\n");
        submitInputRef.current(line);
    }, []);

    const backspace = useCallback(() => {
        if (lineBufferRef.current.length === 0) {
            return;
        }
        lineBufferRef.current = lineBufferRef.current.slice(0, -1);
        termRef.current?.write("\b \b");
    }, []);

    const handleKey = useCallback(
        (ch: string) => {
            if (ch === "\r") {
                submitLine();
                return;
            }
            if (ch === "\x7f") {
                backspace();
                return;
            }
            if (ch === "\x1b") {
                cancelInputRef.current();
                return;
            }
            if (ch >= " ") {
                lineBufferRef.current += ch;
                termRef.current?.write(ch);
            }
        },
        [submitLine, backspace],
    );

    const handleData = useCallback(
        (data: string) => {
            if (!awaitingRef.current) {
                return;
            }
            for (const ch of data) {
                handleKey(ch);
            }
        },
        [handleKey],
    );

    useEffect(() => {
        if (awaitingInput) {
            termRef.current?.focus();
        }
    }, [awaitingInput]);

    const handleClear = useCallback(() => {
        writtenCountRef.current = 0;
        termRef.current?.write(CLEAR_ESCAPE);
        onClear();
    }, [onClear]);

    return { termRef, handleReady, handleData, handleClear };
}
