import { ClientBox, type Language, type RunResult } from "clientbox";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import {
    buildEntryCommand,
    buildVirtualFilesScript,
    detectBusyGameLoop,
    detectPygameProject,
    loadPyScript,
    PYTHON_RUN_TIMEOUT_MS,
    type PyScriptDonkey,
    pyscriptProgressLabel,
} from "~/lib/pyscript";
import type {
    PygameInputEvent,
    PygameWorkerResponse,
} from "~/workers/pygameWorker";

export interface OutputLine {
    id: number;
    stream: "stdout" | "stderr";
    text: string;
}

export type RunMode = "clientbox" | "python" | "pygame";

const LINE_BREAK = /\r?\n/;

const MAX_OUTPUT_LINES = 500;

const PYGAME_KEY_MAP: Record<string, number> = {
    Escape: 27,
    Space: 32,
    Return: 13,
    Enter: 13,
    Tab: 9,
    Backspace: 8,
    Delete: 127,
    ArrowLeft: 1073741904,
    ArrowRight: 1073741903,
    ArrowUp: 1073741906,
    ArrowDown: 1073741905,
    ShiftLeft: 1073742049,
    ShiftRight: 1073742050,
    ControlLeft: 1073742048,
    ControlRight: 1073742051,
    AltLeft: 1073742052,
    AltRight: 1073742053,
    F1: 1073741882,
    F2: 1073741883,
    F3: 1073741884,
    F4: 1073741885,
    F5: 1073741886,
    F6: 1073741887,
    F7: 1073741888,
    F8: 1073741889,
    F9: 1073741890,
    F10: 1073741891,
    F11: 1073741892,
    F12: 1073741893,
};

function toPygameKey(key: string): number {
    if (key.length === 1) {
        return key.charCodeAt(0);
    }
    return PYGAME_KEY_MAP[key] ?? 0;
}

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
 * 把运行失败转成合成结果。
 * @param message - 错误信息。
 * @returns exitCode 为 1 的 RunResult。
 */
function toErrorResult(message: string): RunResult {
    return {
        stdout: "",
        stderr: "",
        error: message,
        exitCode: 1,
        duration: 0,
    };
}

function nextFrame(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
}

/**
 * 带超时的异步任务；超时先执行 `onTimeout` 再以错误拒绝。
 * @param task - 任务。
 * @param onTimeout - 超时回调（如终止执行器）。
 * @param timeoutMs - 超时毫秒数。
 */
function withTimeout<T>(
    task: () => Promise<T>,
    onTimeout: () => void,
    timeoutMs: number,
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = window.setTimeout(() => {
            onTimeout();
            reject(new Error(`Python 运行超时（超过 ${timeoutMs / 1000}s）`));
        }, timeoutMs);
        task().then(
            (value) => {
                window.clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                window.clearTimeout(timer);
                reject(error);
            },
        );
    });
}

/**
 * 运行器封装。
 * @remarks Python 走 PyScript（@pyscript/core：普通脚本用 donkey worker；
 * pygame 项目用 Web Worker + OffscreenCanvas：SDL 在 worker 内渲染，
 * 用户代码经 AST 注入让步语句，worker 可响应停止/输入消息）；其余语言沿用
 * clientbox。公开接口与旧实现一致，输出按行流式追加，只保留最近 500 行。
 */
export function useCodeRunner() {
    const boxRef = useRef<ClientBox | null>(null);
    const inputResolverRef = useRef<((value: string | null) => void) | null>(
        null,
    );
    const donkeyRef = useRef<PyScriptDonkey | null>(null);
    const pygameWorkerRef = useRef<Worker | null>(null);
    const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
    const pygameStartedAtRef = useRef(0);
    const pygameRunningRef = useRef(false);
    const inputCleanupRef = useRef<Array<() => void>>([]);
    const [running, setRunning] = useState(false);
    const [output, setOutput] = useState<OutputLine[]>([]);
    const [result, setResult] = useState<RunResult | null>(null);
    const [awaitingInput, setAwaitingInput] = useState(false);
    const [mode, setMode] = useState<RunMode>("clientbox");
    const [loadStage, setLoadStage] = useState<string | null>(null);
    const [loopHint, setLoopHint] = useState(false);

    const terminalId = `pyterm-${useId().replace(/:/g, "")}`;
    const canvasId = `pygame-canvas-${useId().replace(/:/g, "")}`;

    /**
     * 监听 PyScript 加载进度事件，返回移除监听的函数。
     * @remarks pyodide 下载/初始化阶段派发 `py:progress`，detail 为阶段文案。
     */
    const listenProgress = useCallback((): (() => void) => {
        const onProgress = (event: Event) => {
            const label = pyscriptProgressLabel((event as CustomEvent).detail);
            if (label) {
                setLoadStage(label);
            }
        };
        window.addEventListener("py:progress", onProgress);
        return () => {
            window.removeEventListener("py:progress", onProgress);
        };
    }, []);

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

    const destroyDonkey = useCallback(() => {
        donkeyRef.current?.kill();
        donkeyRef.current = null;
    }, []);

    const clearPyGameCanvas = useCallback(() => {
        const canvas = document.getElementById(
            canvasId,
        ) as HTMLCanvasElement | null;
        canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }, [canvasId]);

    const detachInputListeners = useCallback(() => {
        for (const remove of inputCleanupRef.current) {
            remove();
        }
        inputCleanupRef.current = [];
    }, []);

    /**
     * 挂载 pygame 输入事件监听：键盘监听在画布级（画布可聚焦，
     * 游戏启动时自动聚焦；焦点在编辑器时按键归编辑器，不干扰写代码），
     * 鼠标事件天然属于画布内操作。
     */
    const attachInputListeners = useCallback((target: HTMLCanvasElement) => {
        const cleanup: Array<() => void> = [];
        let lastMoveAt = 0;
        const send = (events: PygameInputEvent[]) => {
            const rect = target.getBoundingClientRect();
            pygameWorkerRef.current?.postMessage({
                type: "input",
                events,
                rect: { width: rect.width, height: rect.height },
            });
        };
        const onKey = (event: KeyboardEvent) => {
            event.preventDefault();
            send([
                {
                    type: event.type === "keydown" ? "keydown" : "keyup",
                    key: toPygameKey(event.key),

                    unicode: event.key.length === 1 ? event.key : "",
                },
            ]);
        };
        const onMouse = (event: MouseEvent) => {
            const rect = target.getBoundingClientRect();
            const pos: [number, number] = [
                Math.round(event.clientX - rect.left),
                Math.round(event.clientY - rect.top),
            ];
            if (event.type === "mousemove") {
                const now = performance.now();
                if (now - lastMoveAt < 30) {
                    return;
                }
                lastMoveAt = now;
                send([
                    {
                        type: "mousemotion",
                        pos,
                        rel: [event.movementX, event.movementY],
                    },
                ]);
            } else if (event.type === "mousedown" || event.type === "mouseup") {
                send([
                    {
                        type:
                            event.type === "mousedown"
                                ? "mousedown"
                                : "mouseup",
                        pos,
                        button: event.button + 1,
                    },
                ]);
            }
        };
        target.addEventListener("keydown", onKey);
        target.addEventListener("keyup", onKey);
        target.addEventListener("mousemove", onMouse);
        target.addEventListener("mousedown", onMouse);
        target.addEventListener("mouseup", onMouse);

        target.focus();
        cleanup.push(
            () => target.removeEventListener("keydown", onKey),
            () => target.removeEventListener("keyup", onKey),
            () => target.removeEventListener("mousemove", onMouse),
            () => target.removeEventListener("mousedown", onMouse),
            () => target.removeEventListener("mouseup", onMouse),
        );
        inputCleanupRef.current = cleanup;
    }, []);

    const handleWorkerMessage = useCallback(
        (event: MessageEvent<PygameWorkerResponse>) => {
            const data = event.data;
            if (data.type === "loading") {
                const label = pyscriptProgressLabel(data.stage);
                if (label) {
                    setLoadStage(label);
                }
            } else if (data.type === "ready" || data.type === "running") {
                setLoadStage(null);
            } else if (data.type === "stdout") {
                append("stdout", data.text);
            } else if (data.type === "stderr") {
                append("stderr", data.text);
            } else if (data.type === "exited") {
                const startedAt = pygameStartedAtRef.current;
                if (data.reason === "error") {
                    setResult(toErrorResult(data.message ?? "Pygame 运行出错"));
                } else {
                    setResult({
                        stdout: "",
                        stderr: "",
                        error: null,
                        exitCode: 0,
                        duration:
                            startedAt > 0 ? performance.now() - startedAt : 0,
                    });
                }
                pygameRunningRef.current = false;
                setRunning(false);
                setLoopHint(false);
                detachInputListeners();
            } else if (data.type === "error") {
                setResult(toErrorResult(data.message));
                pygameRunningRef.current = false;
                setRunning(false);
                setLoopHint(false);
            }
        },
        [append, detachInputListeners],
    );

    const teardownPygameWorker = useCallback(() => {
        pygameWorkerRef.current?.terminate();
        pygameWorkerRef.current = null;
        canvasElementRef.current = null;
        pygameRunningRef.current = false;
        detachInputListeners();
    }, [detachInputListeners]);

    const stop = useCallback(() => {
        setRunning(false);
        setLoopHint(false);
        const startedAt = pygameStartedAtRef.current;
        setResult({
            stdout: "",
            stderr: "",
            error: null,
            exitCode: 0,
            duration: startedAt > 0 ? performance.now() - startedAt : 0,
        });
        const worker = pygameWorkerRef.current;
        if (worker) {
            worker.postMessage({ type: "stop" });
            window.setTimeout(() => {
                if (pygameRunningRef.current) {
                    teardownPygameWorker();
                }
            }, 3000);
        }
    }, [teardownPygameWorker]);

    const runClientBox = useCallback(
        async (
            files: Record<string, string>,
            entryPoint: string,
            language: Language,
        ) => {
            setRunning(true);
            setResult(null);
            setOutput([]);
            setAwaitingInput(false);
            setLoadStage(null);
            setLoopHint(false);
            inputResolverRef.current = null;
            if (boxRef.current === null) {
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
                setResult(toErrorResult(message));
            } finally {
                setRunning(false);
                setAwaitingInput(false);
                inputResolverRef.current = null;
            }
        },
        [append, requestInput],
    );

    /**
     * 普通 Python：donkey worker 执行，输出到 xterm 终端。
     * @remarks worker 在首次运行时创建并复用（pyodide 只加载一次）；
     * 每次运行先清空终端再执行，状态残留极小（用户代码经 runpy 隔离）。
     * 终端容器若已卸载（关闭面板 / 切换语言）则重建会话，避免输出挂到
     * 已分离的 xterm 上不可见。
     */
    const runPython = useCallback(
        async (files: Record<string, string>, entryPoint: string) => {
            const started = performance.now();
            setRunning(true);
            setResult(null);
            setOutput([]);
            setAwaitingInput(false);
            setLoadStage(null);
            setLoopHint(false);
            inputResolverRef.current = null;
            setMode("python");
            await nextFrame();
            const stopListening = listenProgress();
            try {
                const exitCode = await withTimeout(
                    async () => {
                        const container = document.getElementById(terminalId);
                        const attached =
                            container !== null &&
                            container.childElementCount > 0;
                        if (donkeyRef.current === null || !attached) {
                            destroyDonkey();
                            const core = await loadPyScript();
                            const donkey = await core.donkey({
                                type: "py",
                                persistent: true,
                                terminal: terminalId,
                            });
                            donkeyRef.current = donkey;
                        }
                        const donkey = donkeyRef.current;
                        await donkey.clear();
                        await donkey.execute(buildVirtualFilesScript(files));
                        await donkey.execute(buildEntryCommand(entryPoint));
                        return Number(await donkey.evaluate("__ps_exit__"));
                    },
                    destroyDonkey,
                    PYTHON_RUN_TIMEOUT_MS,
                );
                setResult({
                    stdout: "",
                    stderr: "",
                    error: null,
                    exitCode,
                    duration: performance.now() - started,
                });
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : String(err);
                setResult(toErrorResult(message));
            } finally {
                stopListening();
                setLoadStage(null);
                setRunning(false);
                setAwaitingInput(false);
                inputResolverRef.current = null;
            }
        },
        [terminalId, destroyDonkey, listenProgress],
    );

    /**
     * pygame 项目：Web Worker + OffscreenCanvas 渲染。
     * @remarks worker 首次运行时创建（pyodide + pygame-ce 只加载一次），
     * 画布控制权随之移交；后续运行若画布元素未变则复用 worker 与
     * OffscreenCanvas。用户代码经 AST 注入 `await asyncio.sleep(0)` 与
     * 停止检查，游戏运行期间 worker 可响应输入/停止消息。
     */
    const runPygame = useCallback(
        async (files: Record<string, string>, entryPoint: string) => {
            setRunning(true);
            setResult(null);
            setOutput([]);
            setAwaitingInput(false);
            setLoadStage("正在加载 Pygame…");
            setLoopHint(detectBusyGameLoop(files[entryPoint] ?? ""));
            inputResolverRef.current = null;
            setMode("pygame");
            await nextFrame();
            try {
                const canvas = document.getElementById(
                    canvasId,
                ) as HTMLCanvasElement | null;
                if (!canvas) {
                    throw new Error("找不到图形画布");
                }
                const reuse =
                    pygameWorkerRef.current !== null &&
                    canvasElementRef.current === canvas;
                if (!reuse) {
                    teardownPygameWorker();
                    const offscreen = canvas.transferControlToOffscreen();
                    const worker = new Worker(
                        new URL("../workers/pygameWorker.ts", import.meta.url),
                        { type: "module" },
                    );
                    worker.addEventListener("message", handleWorkerMessage);
                    pygameWorkerRef.current = worker;
                    canvasElementRef.current = canvas;
                    attachInputListeners(canvas);
                    pygameRunningRef.current = true;
                    pygameStartedAtRef.current = performance.now();
                    worker.postMessage(
                        {
                            type: "run",
                            canvas: offscreen,
                            files,
                            entryPoint,
                        },
                        [offscreen],
                    );
                } else {
                    attachInputListeners(canvas);
                    pygameRunningRef.current = true;
                    pygameStartedAtRef.current = performance.now();
                    pygameWorkerRef.current?.postMessage({
                        type: "run",
                        files,
                        entryPoint,
                    });
                }
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : String(err);
                setResult(toErrorResult(message));
                setRunning(false);
                setLoopHint(false);
            }
        },
        [
            canvasId,
            attachInputListeners,
            handleWorkerMessage,
            teardownPygameWorker,
        ],
    );

    const run = useCallback(
        async (
            files: Record<string, string>,
            entryPoint: string,
            language: Language,
        ) => {
            if (language !== "python") {
                setMode("clientbox");
                return runClientBox(files, entryPoint, language);
            }
            if (detectPygameProject(files)) {
                return runPygame(files, entryPoint);
            }
            return runPython(files, entryPoint);
        },
        [runClientBox, runPygame, runPython],
    );

    const clear = useCallback(() => {
        setOutput([]);
        setResult(null);
        setAwaitingInput(false);
        setLoadStage(null);
        setLoopHint(false);
        inputResolverRef.current = null;
        if (mode === "python") {
            donkeyRef.current?.clear().catch(() => undefined);
        } else if (mode === "pygame") {
            clearPyGameCanvas();
        }
    }, [mode, clearPyGameCanvas]);

    useEffect(
        () => () => {
            boxRef.current?.destroy();
            boxRef.current = null;
            destroyDonkey();
            teardownPygameWorker();
        },
        [destroyDonkey, teardownPygameWorker],
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
        mode,
        terminalId,
        canvasId,
        stop,
        loadStage,
        loopHint,
    };
}
