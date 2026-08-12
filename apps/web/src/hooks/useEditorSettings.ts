import { useCallback, useState } from "react";

const FONT_SIZE_KEY = "editor.fontSize";
const FONT_FAMILY_KEY = "editor.fontFamily";

export const EDITOR_FONT_SIZE_MIN = 10;
export const EDITOR_FONT_SIZE_MAX = 28;
export const DEFAULT_EDITOR_FONT_SIZE = 13;

export const EDITOR_FONT_OPTIONS: ReadonlyArray<{
    label: string;
    value: string;
}> = [
    { label: "Consolas", value: "Consolas, 'Courier New', monospace" },
    { label: "Menlo", value: "Menlo, Consolas, 'Courier New', monospace" },
    {
        label: "JetBrains Mono",
        value: "'JetBrains Mono', Consolas, monospace",
    },
    { label: "Fira Code", value: "'Fira Code', Consolas, monospace" },
    {
        label: "Source Code Pro",
        value: "'Source Code Pro', Consolas, monospace",
    },
];

const DEFAULT_EDITOR_FONT_FAMILY = EDITOR_FONT_OPTIONS[0].value;

function readFontSize(): number {
    const value = Number(localStorage.getItem(FONT_SIZE_KEY));
    if (!Number.isInteger(value)) {
        return DEFAULT_EDITOR_FONT_SIZE;
    }
    return Math.min(
        Math.max(value, EDITOR_FONT_SIZE_MIN),
        EDITOR_FONT_SIZE_MAX,
    );
}

function readFontFamily(): string {
    const value = localStorage.getItem(FONT_FAMILY_KEY);
    return value && EDITOR_FONT_OPTIONS.some((font) => font.value === value)
        ? value
        : DEFAULT_EDITOR_FONT_FAMILY;
}

/**
 * Monaco 编辑器偏好。
 * @returns 字号与字体；修改会写入 localStorage 持久化。
 */
export function useEditorSettings() {
    const [fontSize, setFontSizeState] = useState<number>(readFontSize);
    const [fontFamily, setFontFamilyState] = useState<string>(readFontFamily);

    const setFontSize = useCallback((value: number) => {
        setFontSizeState(value);
        localStorage.setItem(FONT_SIZE_KEY, String(value));
    }, []);

    const setFontFamily = useCallback((value: string) => {
        setFontFamilyState(value);
        localStorage.setItem(FONT_FAMILY_KEY, value);
    }, []);

    return { fontSize, fontFamily, setFontSize, setFontFamily };
}
