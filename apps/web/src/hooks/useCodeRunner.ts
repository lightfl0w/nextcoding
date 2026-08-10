import { ClientBox, type Language, type RunResult } from "clientbox";
import { useCallback, useEffect, useRef, useState } from "react";

export interface OutputLine {
    id: number;
    stream: "stdout" | "stderr" | "system";
    text: string;
}

let nextLineId = 1;

function splitLines(text: string): string[] {
    return text.split(/\r?\n/);
}

/**
 * 封装 clientbox 在浏览器端的运行生命周期：
 * 懒创建 ClientBox、流式输出聚合、运行结果与清理。
 */
export function useCodeRunner() {
    const boxRef = useRef<ClientBox | null>(null);
    const [running, setRunning] = useState(false);
    const [output, setOutput] = useState<OutputLine[]>([]);
    const [result, setResult] = useState<RunResult | null>(null);

    const append = useCallback((stream: OutputLine["stream"], text: string) => {
        const lines = splitLines(text);
        setOutput((prev) => {
            const next = [...prev];
            for (const line of lines) {
                next.push({ id: nextLineId++, stream, text: line });
            }
            return next;
        });
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
            if (!boxRef.current) boxRef.current = new ClientBox();
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
                });
                if (!streamed) {
                    if (res.stdout) append("stdout", res.stdout);
                    if (res.stderr) append("stderr", res.stderr);
                    if (res.error) append("stderr", res.error);
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
            }
        },
        [append],
    );

    const clear = useCallback(() => {
        setOutput([]);
        setResult(null);
    }, []);

    useEffect(
        () => () => {
            boxRef.current?.destroy();
            boxRef.current = null;
        },
        [],
    );

    return { running, output, result, run, clear };
}
