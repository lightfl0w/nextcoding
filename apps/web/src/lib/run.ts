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

/**
 * 文件列表转成 clientbox 源映射。
 * @param files - 文件列表。
 * @returns 键为绝对路径的源映射。
 */
export function toSources(files: RunnableFile[]): Record<string, string> {
    return Object.fromEntries(
        files.map((file) => [`/${file.name}`, file.content]),
    );
}

/**
 * 识别项目运行时。
 * @param names - 项目文件名列表。
 * @returns 运行时信息；无法识别时返回 `null`。
 */
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

/**
 * 终端输出格式化。
 * @param lines - 输出行。
 * @returns 以 `\r\n` 拼接的文本，stderr 行包上 ANSI 红色转义。
 */
export function formatOutputLines(
    lines: ReadonlyArray<{ stream: "stdout" | "stderr"; text: string }>,
): string {
    return `${lines
        .map((line) =>
            line.stream === "stderr"
                ? `\x1b[31m${line.text}\x1b[0m`
                : line.text,
        )
        .join("\r\n")}\r\n`;
}

/**
 * 拼接「不支持运行」提示。
 * @param names - 文件名列表。
 * @param emptyHint - 列表为空时返回的提示。
 * @returns 完整提示文案；单个文件时省略「等文件」。
 */
export function unsupportedRuntimeMessage(
    names: string[],
    emptyHint = "还没有文件可运行",
): string {
    if (names.length === 0) {
        return emptyHint;
    }
    const quoted = `「${names[0]}」`;
    return `${quoted}${names.length === 1 ? "" : "等文件"}暂不支持在线运行，请使用 ${SUPPORTED_RUNTIMES}`;
}
