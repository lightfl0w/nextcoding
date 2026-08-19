export const PYTHON_RUN_TIMEOUT_MS = 30_000;

type PyScriptCore = typeof import("@pyscript/core/js");

/**
 * donkey 执行器接口（@pyscript/core 返回对象的子集）。
 * @remarks `execute`/`evaluate` 通过 `exec`/`eval` 在 worker 内执行代码；
 * 输出写入其挂载的 xterm 终端，`input()` 在终端内联读取。
 */
export interface PyScriptDonkey {
    process(code: string): Promise<unknown>;
    execute(code: string): Promise<unknown>;
    evaluate(code: string): Promise<unknown>;
    clear(): Promise<void>;
    reset(): Promise<void>;
    kill(): void;
}

let corePromise: Promise<PyScriptCore> | null = null;

/**
 * 懒加载 PyScript 运行时（幂等，并发调用共享同一个 Promise）。
 * @returns 导入完成的 @pyscript/core 模块。
 */
export function loadPyScript(): Promise<PyScriptCore> {
    corePromise ??= import("@pyscript/core/js");
    return corePromise;
}

const PYGAME_IMPORT = /\bimport\s+pygame\b|\bfrom\s+pygame(?:\s+import|\s*\.)/;

/**
 * 判断项目是否为 pygame 项目。
 * @param files - 键为文件名的源码映射。
 * @returns 仅当某行（非注释）含 `import pygame` / `from pygame` 时视为
 * pygame 项目，避免注释/字符串提到 pygame 被误判进重量级加载路径。
 */
export function detectPygameProject(files: Record<string, string>): boolean {
    return Object.values(files).some((content) =>
        content.split("\n").some((line) => {
            const trimmed = line.trimStart();
            return !trimmed.startsWith("#") && PYGAME_IMPORT.test(trimmed);
        }),
    );
}

const PYSCRIPT_PROGRESS_LABELS: Record<string, string> = {
    "Loading Pyodide": "正在下载 Python 运行环境…",
    "Loading Packages Graph": "正在解析依赖…",
    "Loaded Packages Graph": "依赖解析完成",
    "Loading remote packages": "正在下载依赖包…",
    "Loaded remote packages": "依赖包下载完成",
    "Loading Storage": "正在加载缓存…",
    "Loaded Storage": "缓存加载完成",
    "Loading interpreter": "正在初始化解释器…",
    "Loaded interpreter": "解释器初始化完成",
    "Loaded Pyodide": "环境就绪",
};

/**
 * 把 PyScript 的 `:progress` 事件 detail 映射为中文加载阶段文案。
 * @param detail - 进度事件携带的状态（字符串）。
 * @returns 已知阶段的中文文案；未知值返回 `null`。
 */
export function pyscriptProgressLabel(detail: unknown): string | null {
    return typeof detail === "string"
        ? (PYSCRIPT_PROGRESS_LABELS[detail] ?? null)
        : null;
}

/**
 * 生成把工作区文件写入虚拟文件系统的 Python 代码。
 * @param files - 键为文件名、值为内容的源码映射。
 * @returns 可注入解释器执行的 Python 代码（含子目录创建）。
 * @remarks 内容经 `JSON.stringify` 转义为 Python 字符串字面量
 * （`\n`、`\\`、`\"`、`\uXXXX` 均为 Python 合法转义）。
 * 实现位于 `pythonVirtualFs.ts`，供主线程与 pygame worker 共享。
 */
export { buildVirtualFilesScript } from "./pythonVirtualFs";

/**
 * 生成执行入口文件的 Python 代码，并把退出码写入 `__ps_exit__`。
 * @param entryPoint - 入口文件路径（可带前导 `/`）。
 * @returns 可直接 `execute` 的代码，异常时打印完整 traceback 并置退出码 1。
 * @remarks 依赖 worker 的 `persistent` 模式让 `__ps_exit__` 跨调用可见。
 */
export function buildEntryCommand(entryPoint: string): string {
    const path = entryPoint.startsWith("/") ? entryPoint : `/${entryPoint}`;
    return [
        "__ps_exit__ = 0",
        "import runpy",
        "try:",
        `    runpy.run_path(${JSON.stringify(path)}, run_name="__main__")`,
        "except BaseException:",
        "    __ps_exit__ = 1",
        "    import traceback",
        "    traceback.print_exc()",
    ].join("\n");
}

export const CANCEL_PYGAME_TASKS = [
    "import asyncio",
    "_ps_current = asyncio.current_task()",
    "for _ps_task in list(asyncio.all_tasks()):",
    "    if _ps_task is not _ps_current:",
    "        _ps_task.cancel()",
].join("\n");

const CLASS_STATEMENT = /^\s*class\s+\w/;

const SYNC_DEF_STATEMENT = /^\s*def\s+\w/;

const ASYNC_DEF_STATEMENT = /^\s*async\s+def\s+\w/;

const WHILE_STATEMENT = /^\s*while\b/;

/**
 * 判断 pygame 游戏循环是否会让出事件循环。
 * @param code - 入口源码。
 * @returns 存在位于类方法（类内同步 `def`）中、未含 `await`/`asyncio.sleep`
 * 的 `while` 循环时返回 `true`。
 * @remarks 顶层 `while` 与模块级函数内的 `while` 都会被 pygame worker 的
 * AST 转换自动注入 `await asyncio.sleep(0)` 与停止检查，无需提示；类方法
 * 不在转换范围（属性调用无法可靠补 `await`），其纯同步循环会饿死 worker
 * 的事件循环，导致游戏无法响应停止与输入。注释行不计入匹配。
 */
export function detectBusyGameLoop(code: string): boolean {
    const lines = code.split("\n");
    const classIndents: number[] = [];
    const defScopes: Array<{ indent: number; sync: boolean }> = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === "" || trimmed.startsWith("#")) {
            continue;
        }
        const indent = line.length - line.trimStart().length;
        while (
            classIndents.length > 0 &&
            indent <= classIndents[classIndents.length - 1]
        ) {
            classIndents.pop();
        }
        while (
            defScopes.length > 0 &&
            indent <= defScopes[defScopes.length - 1].indent
        ) {
            defScopes.pop();
        }
        if (CLASS_STATEMENT.test(line)) {
            classIndents.push(indent);
            continue;
        }
        if (ASYNC_DEF_STATEMENT.test(line)) {
            defScopes.push({ indent, sync: false });
            continue;
        }
        if (SYNC_DEF_STATEMENT.test(line)) {
            defScopes.push({
                indent,
                sync: classIndents.length > 0,
            });
            continue;
        }
        if (WHILE_STATEMENT.test(line)) {
            const scope = defScopes[defScopes.length - 1];
            if (scope?.sync) {
                return true;
            }
        }
    }
    return false;
}
