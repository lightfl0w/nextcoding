import type * as Monaco from "monaco-editor";

import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";
import CSSWorker from "monaco-editor/language/css/css.worker.js?worker";
import HTMLWorker from "monaco-editor/language/html/html.worker.js?worker";
import JSONWorker from "monaco-editor/language/json/json.worker.js?worker";
import TSWorker from "monaco-editor/language/typescript/ts.worker.js?worker";

let monacoPromise: Promise<typeof Monaco> | null = null;

export function loadMonaco(): Promise<typeof Monaco> {
    monacoPromise ??= import("monaco-editor").then(async (mod) => {
        const monaco = mod.default ?? mod;

        globalThis.MonacoEnvironment = {
            getWorker(_: unknown, label: string) {
                if (label === "json") return new JSONWorker();
                if (
                    label === "css" ||
                    label === "scss" ||
                    label === "less"
                ) {
                    return new CSSWorker();
                }
                if (
                    label === "html" ||
                    label === "handlebars" ||
                    label === "razor"
                ) {
                    return new HTMLWorker();
                }
                if (label === "typescript" || label === "javascript") {
                    return new TSWorker();
                }
                return new EditorWorker();
            },
        };


        const tsLanguage = (monaco.languages as unknown as {
            typescript?: {
                typescriptDefaults: {
                    setCompilerOptions(options: Record<string, unknown>): void;
                    setEagerModelSync(value: boolean): void;
                };
                javascriptDefaults: {
                    setCompilerOptions(options: Record<string, unknown>): void;
                };
            };
        }).typescript;
        if (tsLanguage) {
            tsLanguage.typescriptDefaults.setCompilerOptions({
                jsx: "react",
                allowNonTsExtensions: true,
                target: "ES2020",
                moduleResolution: "node",
            });
            tsLanguage.javascriptDefaults.setCompilerOptions({
                allowNonTsExtensions: true,
                target: "ES2020",
            });
            tsLanguage.typescriptDefaults.setEagerModelSync(true);
        }

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
