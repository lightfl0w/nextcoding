import type { Language } from "clientbox";

const ENTRY_POINTS: ReadonlyArray<{ file: string; language: Language }> = [
    { file: "index.html", language: "web" },
    { file: "index.htm", language: "web" },
    { file: "main.py", language: "python" },
    { file: "index.py", language: "python" },
    { file: "index.js", language: "node" },
    { file: "main.js", language: "node" },
    { file: "app.js", language: "node" },
    { file: "index.ts", language: "node" },
    { file: "main.ts", language: "node" },
    { file: "index.jsx", language: "node" },
    { file: "Program.cs", language: "csharp" },
    { file: "Main.java", language: "java" },
    { file: "index.php", language: "php" },
    { file: "main.dart", language: "dart" },
    { file: "main.go", language: "go" },
];

const FALLBACK_BY_EXTENSION: ReadonlyArray<{
    extension: string;
    language: Language;
}> = [
    { extension: ".html", language: "web" },
    { extension: ".py", language: "python" },
    { extension: ".js", language: "node" },
    { extension: ".mjs", language: "node" },
    { extension: ".cjs", language: "node" },
    { extension: ".ts", language: "node" },
    { extension: ".jsx", language: "node" },
    { extension: ".cs", language: "csharp" },
    { extension: ".java", language: "java" },
    { extension: ".php", language: "php" },
    { extension: ".dart", language: "dart" },
    { extension: ".go", language: "go" },
];

const LANGUAGE_LABELS: Record<Language, string> = {
    node: "Node.js",
    python: "Python",
    web: "HTML/CSS/JS",
    csharp: "C#",
    java: "Java",
    php: "PHP",
    dart: "Dart",
    go: "Go",
};

const SUPPORTED_RUNTIMES =
    "Node.js(.js/.ts)、Python(.py)、HTML(.html)、C#(.cs)、Java(.java)、PHP(.php)、Dart(.dart)、Go(.go)";

export interface RuntimeInfo {
    language: Language;
    entryPoint: string;
}

export interface RunnableFile {
    name: string;
    content: string;
}

export function toSources(files: RunnableFile[]): Record<string, string> {
    return Object.fromEntries(
        files.map((file) => [`/${file.name}`, file.content]),
    );
}

export function detectRuntime(names: string[]): RuntimeInfo | null {
    const available = new Set(names);

    for (const { file, language } of ENTRY_POINTS) {
        if (available.has(file)) {
            return { language, entryPoint: `/${file}` };
        }
    }

    for (const { extension, language } of FALLBACK_BY_EXTENSION) {
        const match = names.find((name) => name.endsWith(extension));
        if (match) {
            return { language, entryPoint: `/${match}` };
        }
    }

    return null;
}

export function languageLabel(language: Language): string {
    return LANGUAGE_LABELS[language];
}

export function unsupportedRuntimeMessage(
    names: string[],
    emptyHint = "还没有文件可运行",
): string {
    if (names.length === 0) {
        return emptyHint;
    }
    return `「${names[0]}」等文件暂不支持在线运行，请使用 ${SUPPORTED_RUNTIMES}`;
}
