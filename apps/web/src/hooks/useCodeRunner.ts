import { ClientBox, type Language, type RunResult } from "clientbox";
import { useCallback, useEffect, useRef, useState } from "react";

export interface OutputLine {
    id: number;
    stream: "stdout" | "stderr";
    text: string;
}

const LINE_BREAK = /\r?\n/;

const MAX_OUTPUT_LINES = 500;

let nextLineId = 1;

function toOutputLines(
    stream: OutputLine["stream"],
    text: string,
): OutputLine[] {
    return text.split(LINE_BREAK).map((line) => ({
        id: nextLineId++,
        stream,
        text: line,
    }));
}

/**
 * clientbox 运行器封装。
 * @remarks 输出按行流式追加，只保留最近 500 行；交互式输入依赖页面跨源隔离。
 */
export function useCodeRunner() {
    const boxRef = useRef<ClientBox | null>(null);
    const inputResolverRef = useRef<((value: string | null) => void) | null>(
        null,
    );
    const [running, setRunning] = useState(false);
    const [output, setOutput] = useState<OutputLine[]>([]);
    const [result, setResult] = useState<RunResult | null>(null);
    const [awaitingInput, setAwaitingInput] = useState(false);

    const append = useCallback((stream: OutputLine["stream"], text: string) => {
        const lines = toOutputLines(stream, text);
        setOutput((current) => current.concat(lines).slice(-MAX_OUTPUT_LINES));
    }, []);

    const requestInput = useCallback(() => {
        setAwaitingInput(true);
        return new Promise<string | null>((resolve) => {
            inputResolverRef.current = resolve;
        });
    }, []);

    const submitInput = useCallback((value: string) => {
        const resolve = inputResolverRef.current;
        inputResolverRef.current = null;
        setAwaitingInput(false);
        resolve?.(value);
    }, []);

    const cancelInput = useCallback(() => {
        const resolve = inputResolverRef.current;
        inputResolverRef.current = null;
        setAwaitingInput(false);
        resolve?.(null);
    }, []);

    const run = useCallback(
        async (
            files: Record<string, string>,
            entryPoint: string,
            language: Language,
        ) => {
            setRunning(true);
            setResult(null);
            setOutput([]);
            setAwaitingInput(false);
            inputResolverRef.current = null;
            if (!boxRef.current) {
                boxRef.current = new ClientBox();
            }
            const box = boxRef.current;
            let streamed = false;
            try {
                const res = await box.run(language, {
                    files,
                    entryPoint,
                    onStdout: (chunk) => {
                        streamed = true;
                        append("stdout", chunk);
                    },
                    onStderr: (chunk) => {
                        streamed = true;
                        append("stderr", chunk);
                    },
                    // 未跨源隔离时传 onInput 会导致整个运行报错，仅在可用时启用
                    ...(crossOriginIsolated ? { onInput: requestInput } : {}),
                });
                if (!streamed) {
                    if (res.stdout) {
                        append("stdout", res.stdout);
                    }
                    if (res.stderr) {
                        append("stderr", res.stderr);
                    }
                    if (res.error) {
                        append("stderr", res.error);
                    }
                }
                setResult(res);
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : String(err);
                append("stderr", message);
                setResult({
                    stdout: "",
                    stderr: "",
                    error: message,
                    exitCode: 1,
                    duration: 0,
                });
            } finally {
                setRunning(false);
                setAwaitingInput(false);
                inputResolverRef.current = null;
            }
        },
        [append, requestInput],
    );

    const clear = useCallback(() => {
        setOutput([]);
        setResult(null);
        setAwaitingInput(false);
        inputResolverRef.current = null;
    }, []);

    useEffect(
        () => () => {
            boxRef.current?.destroy();
            boxRef.current = null;
        },
        [],
    );

    return {
        running,
        output,
        result,
        run,
        clear,
        awaitingInput,
        submitInput,
        cancelInput,
    };
}
