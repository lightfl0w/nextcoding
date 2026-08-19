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
    | {
          type: "input";
          events: PygameInputEvent[];
          rect?: { width: number; height: number };
      };

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
    | { type: "stdout"; text: string }
    | { type: "stderr"; text: string }
    | { type: "error"; message: string; stack?: string };

/**
 * AST 转换（Python）：向 while 循环注入停止检查与 `await asyncio.sleep(0)`，
 * 把顶级代码包装进 `async def main()`，并吞掉游戏收尾的 `sys.exit()`
 * （SystemExit 视为正常退出而非运行错误）。
 * 函数体内的循环：含循环的**模块级**同步函数整体转成 `async def`
 * （同步函数里无法 `await`），其调用点补 `await`（含传递调用链），这样
 * `def main(): while True:` 这类游戏在运行期间也能让出事件循环、响应
 * 停止与输入。类方法不转换（`self.run()` 等属性调用无法可靠补 await），
 * 保持同步语义。含 `yield` 的生成器函数不转换。
 * 实测要点：模块级 `import *` 留在模块层；停止检查走函数调用
 * （pyodide 的 js 属性读取有缓存）。
 */
const TRANSFORM_CODE = `import ast

class LoopFinder(ast.NodeVisitor):
    def __init__(self):
        self.has_loop = False
        self.has_yield = False
        self.depth = 0

    def visit_FunctionDef(self, node):
        if self.depth == 0:
            # 只分析目标函数自身，嵌套函数整体跳过
            self.depth = 1
            self.generic_visit(node)
            self.depth = 0

    visit_AsyncFunctionDef = visit_FunctionDef

    def visit_While(self, node):
        if self.depth > 0:
            self.has_loop = True
        self.generic_visit(node)

    def visit_Yield(self, node):
        if self.depth > 0:
            self.has_yield = True
        self.generic_visit(node)

    visit_YieldFrom = visit_Yield

def collect_async_set(tree):
    funcs = []

    def walk(node, in_class):
        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                funcs.append((child, in_class))
                walk(child, in_class)
            elif isinstance(child, ast.ClassDef):
                walk(child, in_class + 1)
            else:
                walk(child, in_class)

    walk(tree, 0)

    async_set = set()
    for fn, in_class in funcs:
        if isinstance(fn, ast.AsyncFunctionDef):
            async_set.add(fn.name)
        elif not in_class:
            # 只转换模块级函数；类方法保持同步（属性调用无法可靠补 await）
            finder = LoopFinder()
            finder.visit(fn)
            if finder.has_loop and not finder.has_yield:
                async_set.add(fn.name)
    # 闭包：调用协程函数的模块级同步函数也要转 async（调用点才能 await）
    changed = True
    while changed:
        changed = False
        for fn, in_class in funcs:
            if (isinstance(fn, ast.FunctionDef) and not in_class
                    and fn.name not in async_set):
                calls = {sub.func.id for sub in ast.walk(fn)
                         if isinstance(sub, ast.Call) and isinstance(sub.func, ast.Name)}
                if calls & async_set:
                    async_set.add(fn.name)
                    changed = True
    return async_set

class GameLoopInjector(ast.NodeTransformer):
    def __init__(self, async_set):
        self.async_set = async_set

    def visit_FunctionDef(self, node):
        if node.name not in self.async_set:
            # 非转换目标（无循环）保持同步，函数体内不注入
            return node
        node.__class__ = ast.AsyncFunctionDef
        return self.generic_visit(node)

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

class AwaitCalls(ast.NodeTransformer):
    def __init__(self, async_set):
        self.async_set = async_set
        self.sync_depth = 0

    def visit_FunctionDef(self, node):
        # 同步函数内不能 await，调用点保持原样（类方法等非转换目标）
        self.sync_depth += 1
        self.generic_visit(node)
        self.sync_depth -= 1
        return node

    def visit_Call(self, node):
        self.generic_visit(node)
        if (self.sync_depth == 0 and isinstance(node.func, ast.Name)
                and node.func.id in self.async_set):
            return ast.Await(value=node)
        return node

def transform(user_code):
    tree = ast.parse(user_code)
    async_set = collect_async_set(tree)
    tree = GameLoopInjector(async_set).visit(tree)
    tree = AwaitCalls(async_set).visit(tree)
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
    run_main = ast.Try(
        body=[await_main],
        handlers=[ast.ExceptHandler(
            type=ast.Name(id="SystemExit", ctx=ast.Load()),
            name=None,
            body=[ast.Pass()])],
        orelse=[],
        finalbody=[])
    tree.body = prelude.body + imports + [main_func, run_main]
    ast.fix_missing_locations(tree)
    return ast.unparse(tree)
`;

const INJECT_CODE = `import pygame
import sys
import io
from js import self as js_self

class _UIStream(io.TextIOBase):
    """将 Python 标准输出转发到主线程，供运行面板终端半区显示。"""
    def __init__(self, kind):
        self._kind = kind
        self._buf = ""

    def write(self, text):
        self._buf += text
        nl = chr(10)
        while nl in self._buf:
            line, self._buf = self._buf.split(nl, 1)
            js_self.postMessage({"type": self._kind, "text": line + nl})
        return len(text)

    def flush(self):
        if self._buf:
            js_self.postMessage({"type": self._kind, "text": self._buf})
            self._buf = ""

sys.stdout = _UIStream("stdout")
sys.stderr = _UIStream("stderr")

_PYGAME_EVENT_TYPES = {
    "keydown": pygame.KEYDOWN,
    "keyup": pygame.KEYUP,
    "mousemotion": pygame.MOUSEMOTION,
    "mousedown": pygame.MOUSEBUTTONDOWN,
    "mouseup": pygame.MOUSEBUTTONUP,
}

def _scale_pos(e, rect_w, rect_h):
    # 画布尺寸（DOM 元素）与游戏窗口尺寸（set_mode）通常不一致，
    # 把画布坐标按比例映射回游戏坐标，否则点击会落在错误的格子上。
    surface = pygame.display.get_surface()
    if surface is None or not rect_w or not rect_h:
        return e.get("pos", (0, 0)), e.get("rel", (0, 0))
    sw, sh = surface.get_size()
    sx = sw / rect_w
    sy = sh / rect_h
    pos = e.get("pos", (0, 0))
    pos = (int(pos[0] * sx), int(pos[1] * sy))
    rel = e.get("rel", (0, 0))
    rel = (int(rel[0] * sx), int(rel[1] * sy))
    return pos, rel

def _inject_event(e, rect_w, rect_h):
    et = _PYGAME_EVENT_TYPES.get(e.get("type"))
    if et is None:
        return
    kw = {}
    if et in (pygame.KEYDOWN, pygame.KEYUP):
        kw["key"] = e.get("key", 0)
        kw["unicode"] = e.get("unicode", "")
    elif et == pygame.MOUSEMOTION:
        pos, rel = _scale_pos(e, rect_w, rect_h)
        kw["pos"] = pos
        kw["rel"] = rel
    else:
        pos, _ = _scale_pos(e, rect_w, rect_h)
        kw["pos"] = pos
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

function injectInput(
    events: PygameInputEvent[],
    rect?: { width: number; height: number },
): void {
    if (py === null) {
        return;
    }
    try {
        const injector = py.globals.get("_inject_event");
        const rectW = rect?.width ?? 0;
        const rectH = rect?.height ?? 0;
        for (const event of events) {
            injector(event, rectW, rectH);
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
                injectInput(message.events, message.rect);
                break;
            }
        }
    } catch (err) {
        const messageText = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? (err.stack ?? "") : "";
        post({ type: "error", message: messageText, stack });
    }
};
