import type { Language } from "clientbox";

/**
 * 依据入口文件约定推断 clientbox 运行语言。
 * 参考 clientbox README：node/python/web/csharp/java/php/dart/go。
 */
const ENTRY_POINTS: Array<{ file: string; language: Language }> = [
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

const FALLBACK_BY_EXT: Array<{ ext: string; language: Language }> = [
    { ext: ".html", language: "web" },
    { ext: ".py", language: "python" },
    { ext: ".js", language: "node" },
    { ext: ".mjs", language: "node" },
    { ext: ".cjs", language: "node" },
    { ext: ".ts", language: "node" },
    { ext: ".jsx", language: "node" },
    { ext: ".cs", language: "csharp" },
    { ext: ".java", language: "java" },
    { ext: ".php", language: "php" },
    { ext: ".dart", language: "dart" },
    { ext: ".go", language: "go" },
];

export interface RuntimeInfo {
    language: Language;
    entryPoint: string;
}

export function detectRuntime(names: string[]): RuntimeInfo | null {
    for (const { file, language } of ENTRY_POINTS) {
        if (names.includes(file)) {
            return { language, entryPoint: `/${file}` };
        }
    }
    for (const { ext, language } of FALLBACK_BY_EXT) {
        const match = names.find((n) => n.endsWith(ext));
        if (match) {
            return { language, entryPoint: `/${match}` };
        }
    }
    return null;
}

export function languageLabel(language: Language): string {
    const labels: Record<Language, string> = {
        node: "Node.js",
        python: "Python",
        web: "HTML/CSS/JS",
        csharp: "C#",
        java: "Java",
        php: "PHP",
        dart: "Dart",
        go: "Go",
    };
    return labels[language];
}
