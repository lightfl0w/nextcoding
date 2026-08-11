import type * as Monaco from "monaco-editor";

import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";
import CSSWorker from "monaco-editor/language/css/css.worker.js?worker";
import HTMLWorker from "monaco-editor/language/html/html.worker.js?worker";
import JSONWorker from "monaco-editor/language/json/json.worker.js?worker";
import TSWorker from "monaco-editor/language/typescript/ts.worker.js?worker";

const WORKER_FACTORY_BY_LABEL: Record<string, () => Worker> = {
    json: () => new JSONWorker(),
    css: () => new CSSWorker(),
    scss: () => new CSSWorker(),
    less: () => new CSSWorker(),
    html: () => new HTMLWorker(),
    handlebars: () => new HTMLWorker(),
    razor: () => new HTMLWorker(),
    typescript: () => new TSWorker(),
    javascript: () => new TSWorker(),
};

function createWorker(label: string): Worker {
    const factory = WORKER_FACTORY_BY_LABEL[label];
    return factory ? factory() : new EditorWorker();
}

interface LanguageDefaults {
    setCompilerOptions(options: Record<string, unknown>): void;
    setEagerModelSync?(value: boolean): void;
}

interface TypescriptLanguage {
    typescriptDefaults: LanguageDefaults;
    javascriptDefaults: LanguageDefaults;
}

const TYPESCRIPT_COMPILER_OPTIONS = {
    jsx: "react",
    allowNonTsExtensions: true,
    target: "ES2020",
    moduleResolution: "node",
};

const JAVASCRIPT_COMPILER_OPTIONS = {
    allowNonTsExtensions: true,
    target: "ES2020",
};

function configureTypescript(monaco: typeof Monaco): void {
    const languages = monaco.languages as unknown as {
        typescript?: TypescriptLanguage;
    };
    const typescript = languages.typescript;
    if (!typescript) return;

    typescript.typescriptDefaults.setCompilerOptions(
        TYPESCRIPT_COMPILER_OPTIONS,
    );
    typescript.javascriptDefaults.setCompilerOptions(
        JAVASCRIPT_COMPILER_OPTIONS,
    );
    typescript.typescriptDefaults.setEagerModelSync?.(true);
}

let monacoPromise: Promise<typeof Monaco> | null = null;

export const LARGE_FILE_BYTES = 512 * 1024;

export function loadMonaco(): Promise<typeof Monaco> {
    monacoPromise ??= import("monaco-editor").then((mod) => {
        const monaco = mod.default ?? mod;

        globalThis.MonacoEnvironment = {
            getWorker: (_: unknown, label: string) => createWorker(label),
        };
        configureTypescript(monaco);

        return monaco;
    });
    return monacoPromise;
}

const LANGUAGE_BY_EXT: Record<string, string> = {
    js: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    jsx: "javascript",
    ts: "typescript",
    mts: "typescript",
    cts: "typescript",
    tsx: "typescript",
    json: "json",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    less: "less",
    md: "markdown",
    markdown: "markdown",
    py: "python",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    h: "c",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    hpp: "cpp",
    sh: "shell",
    bash: "shell",
    yml: "yaml",
    yaml: "yaml",
    xml: "xml",
    sql: "sql",
    vue: "html",
    svelte: "html",
};

export function languageFromName(name: string): string {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    return LANGUAGE_BY_EXT[ext] ?? "plaintext";
}
