/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
// biome-ignore-all lint/suspicious/noExplicitAny: pyodide 为无类型定义的外部 WASM 运行时

import { buildVirtualFilesScript } from "~/lib/pythonVirtualFs";

declare const self: DedicatedWorkerGlobalScope;

const PYODIDE_BASE = "https://cdn.jsdelivr.net/pyodide/v314.0.2/full";

export interface PygameInputEvent {
    type: "keydown" | "keyup" | "mousemotion" | "mousedown" | "mouseup";
    key?: number;
    unicode?: string;
    pos?: [number, number];
    rel?: [number, number];
    button?: number;
}

export type PygameWorkerRequest =
    | {
          type: "run";
          canvas?: OffscreenCanvas;
          files: Record<string, string>;
          entryPoint: string;
      }
    | { type: "stop" }
    | { type: "kill" }
    | { type: "input"; events: PygameInputEvent[] };

export type PygameWorkerResponse =
    | { type: "loading"; stage: string }
    | { type: "ready" }
    | { type: "running" }
    | {
          type: "exited";
          reason: "stopped" | "error";
          message?: string;
          stack?: string;
      }
    | { type: "error"; message: string; stack?: string };

/**
 * AST 转换（Python）：向用户代码的顶级 while 循环注入停止检查与
 * `await asyncio.sleep(0)`，并把顶级代码包装进 `async def main()`。
 * 实测要点：模块级 `import *` 留在模块层；用 AsyncFunctionDef 生成
 * `async def`；停止检查走函数调用（pyodide 的 js 属性读取有缓存）。
 */
const TRANSFORM_CODE = `import ast

class GameLoopInjector(ast.NodeTransformer):
    def visit_FunctionDef(self, node):
        # 跳过用户定义的函数（其内部循环保持同步，避免 async 传递问题）
        return node

    def visit_While(self, node):
        self.generic_visit(node)
        node.body.insert(0, ast.If(
            test=ast.Call(
                func=ast.Attribute(value=ast.Name(id="js_self", ctx=ast.Load()), attr="check_stop", ctx=ast.Load()),
                args=[], keywords=[]),
            body=[ast.Break()],
            orelse=[]))
        node.body.append(ast.Expr(value=ast.Await(value=ast.Call(
            func=ast.Attribute(value=ast.Name(id="asyncio", ctx=ast.Load()), attr="sleep", ctx=ast.Load()),
            args=[ast.Constant(value=0)], keywords=[]))))
        return node

def transform(user_code):
    tree = ast.parse(user_code)
    injector = GameLoopInjector()
    tree = injector.visit(tree)
    imports = [n for n in tree.body if isinstance(n, (ast.Import, ast.ImportFrom))]
    rest = [n for n in tree.body if not isinstance(n, (ast.Import, ast.ImportFrom))]
    prelude = ast.parse("import asyncio\\nfrom js import self as js_self\\n")
    main_func = ast.AsyncFunctionDef(
        name="main",
        args=ast.arguments(posonlyargs=[], args=[], kwonlyargs=[], kw_defaults=[], defaults=[]),
        body=rest,
        decorator_list=[])
    await_main = ast.Expr(value=ast.Await(value=ast.Call(
        func=ast.Name(id="main", ctx=ast.Load()), args=[], keywords=[])))
    tree.body = prelude.body + imports + [main_func, await_main]
    ast.fix_missing_locations(tree)
    return ast.unparse(tree)
`;

const INJECT_CODE = `import pygame

_PYGAME_EVENT_TYPES = {
    "keydown": pygame.KEYDOWN,
    "keyup": pygame.KEYUP,
    "mousemotion": pygame.MOUSEMOTION,
    "mousedown": pygame.MOUSEBUTTONDOWN,
    "mouseup": pygame.MOUSEBUTTONUP,
}

def _inject_event(e):
    et = _PYGAME_EVENT_TYPES.get(e.get("type"))
    if et is None:
        return
    kw = {}
    if et in (pygame.KEYDOWN, pygame.KEYUP):
        kw["key"] = e.get("key", 0)
        kw["unicode"] = e.get("unicode", "")
    elif et == pygame.MOUSEMOTION:
        kw["pos"] = tuple(e.get("pos", (0, 0)))
        kw["rel"] = tuple(e.get("rel", (0, 0)))
    else:
        kw["pos"] = tuple(e.get("pos", (0, 0)))
        kw["button"] = e.get("button", 1)
    pygame.event.post(pygame.event.Event(et, **kw))
`;

let py: any = null;
let canvas: OffscreenCanvas | null = null;

const post = (message: PygameWorkerResponse): void => {
    self.postMessage(message);
};

function installShims(): void {
    const screen = {
        width: 640,
        height: 480,
        availWidth: 640,
        availHeight: 480,
        colorDepth: 24,
        pixelDepth: 24,
        orientation: { type: "landscape-primary" },
    };
    const canvasLike = () => ({
        style: {},
        setAttribute() {},
        appendChild() {},
        getContext: () => null,
        addEventListener() {},
        removeEventListener() {},
        getBoundingClientRect: () => ({
            left: 0,
            top: 0,
            width: 640,
            height: 480,
        }),
    });
    const documentShim = {
        getElementById: () => canvas,
        querySelector: () => canvas,
        querySelectorAll: () => [canvas],
        createElement: () => canvasLike(),
        createTextNode: () => ({}),
        body: { appendChild() {}, style: {} },
        head: { appendChild() {}, style: {} },
        documentElement: { style: {} },
        addEventListener() {},
        removeEventListener() {},
        fonts: {
            add() {},
            load() {
                return Promise.resolve([]);
            },
        },
    };
    const targets: Record<string, unknown> = {
        screen,
        devicePixelRatio: 1,
        navigator: {
            userAgent: "Mozilla/5.0 (Worker)",
            platform: "WebAssembly",
            language: "en-US",
            hardwareConcurrency: 4,
        },
        location: {
            href: "about:blank",
            hostname: "worker",
            protocol: "https:",
            pathname: "/",
            search: "",
            hash: "",
        },
        document: documentShim,
    };
    for (const [name, val] of Object.entries(targets)) {
        try {
            if ((globalThis as any)[name] === undefined) {
                (globalThis as any)[name] = val;
            }
        } catch {}
    }
    try {
        if ((globalThis as any).window === undefined) {
            (globalThis as any).window = globalThis;
        }
    } catch {}
}

function patchCanvas(target: OffscreenCanvas): void {
    const rect = () => ({
        left: 0,
        top: 0,
        width: target.width,
        height: target.height,
        right: target.width,
        bottom: target.height,
        x: 0,
        y: 0,
    });
    const noop = () => undefined;
    const patch: Record<string, unknown> = {
        id: "canvas",
        style: {},
        getBoundingClientRect: rect,
        setAttribute: noop,
        getAttribute: () => null,
        focus: noop,
        blur: noop,
        requestPointerLock: noop,
    };
    for (const [key, value] of Object.entries(patch)) {
        try {
            (target as any)[key] = value;
        } catch {}
    }
    try {
        Object.defineProperty(target, "ownerDocument", {
            value: (globalThis as any).document,
            configurable: true,
        });
    } catch {}
}

async function ensurePyodide(): Promise<any> {
    if (py !== null) {
        return py;
    }
    post({ type: "loading", stage: "Loading Pyodide" });
    const { loadPyodide } = await import(
        /* @vite-ignore */ `${PYODIDE_BASE}/pyodide.mjs`
    );
    py = await loadPyodide();
    post({ type: "loading", stage: "Loading interpreter" });
    await py.loadPackage("pygame-ce");
    if (canvas !== null) {
        py.canvas.setCanvas2D(canvas);
    }
    py.runPython(INJECT_CODE);
    py.runPython(TRANSFORM_CODE);
    return py;
}

async function runGame(
    files: Record<string, string>,
    entryPoint: string,
): Promise<void> {
    const interpreter = await ensurePyodide();
    interpreter.runPython(buildVirtualFilesScript(files));
    const entry = files[entryPoint] ?? "";
    interpreter.globals.set("_user_code", entry);
    interpreter.runPython("_transformed = transform(_user_code)");
    const transformed = interpreter.globals.get("_transformed");

    (globalThis as any).stopFlag = false;
    (globalThis as any).check_stop = () =>
        Boolean((globalThis as any).stopFlag);
    post({ type: "ready" });
    post({ type: "running" });
    try {
        await interpreter.runPythonAsync(transformed);
        post({ type: "exited", reason: "stopped" });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? (err.stack ?? "") : "";
        post({ type: "exited", reason: "error", message, stack });
    }
}

function injectInput(events: PygameInputEvent[]): void {
    if (py === null) {
        return;
    }
    try {
        const injector = py.globals.get("_inject_event");
        for (const event of events) {
            injector(event);
        }
    } catch {}
}

self.onmessage = async (event: MessageEvent<PygameWorkerRequest>) => {
    const message = event.data;
    try {
        switch (message.type) {
            case "run": {
                if (message.canvas) {
                    canvas = message.canvas;
                    installShims();
                    patchCanvas(canvas);
                }
                await runGame(message.files, message.entryPoint);
                break;
            }
            case "stop": {
                (globalThis as any).stopFlag = true;
                break;
            }
            case "kill": {
                self.close();
                break;
            }
            case "input": {
                injectInput(message.events);
                break;
            }
        }
    } catch (err) {
        const messageText = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? (err.stack ?? "") : "";
        post({ type: "error", message: messageText, stack });
    }
};
