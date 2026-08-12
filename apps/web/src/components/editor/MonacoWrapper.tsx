import type * as Monaco from "monaco-editor";
import { useEffect, useRef } from "react";

interface MonacoWrapperProps {
    monaco: typeof Monaco | null;
    theme: "light" | "dark";
    fontSize: number;
    fontFamily: string;
    onReady: (editor: Monaco.editor.IStandaloneCodeEditor) => void;
    onDispose?: () => void;
}

/**
 * monaco 编辑器承载。
 * @param props.monaco - monaco 模块实例。
 * @param props.theme - 明暗主题。
 * @param props.fontSize - 字号。
 * @param props.fontFamily - 字体栈。
 * @param props.onReady - 编辑器创建完成回调。
 * @param props.onDispose - 编辑器销毁回调。
 * @remarks 主题与字体只更新选项，不重建编辑器实例。
 */
export function MonacoWrapper({
    monaco,
    theme,
    fontSize,
    fontFamily,
    onReady,
    onDispose,
}: MonacoWrapperProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    const onDisposeRef = useRef(onDispose);
    onDisposeRef.current = onDispose;

    // biome-ignore lint/correctness/useExhaustiveDependencies: 字体由下方 effect 单独更新，不在此重建编辑器
    useEffect(() => {
        if (!monaco || !containerRef.current) {
            return;
        }

        const editor = monaco.editor.create(containerRef.current, {
            theme: theme === "dark" ? "vs-dark" : "vs",
            automaticLayout: true,
            fontSize,
            fontFamily,
            lineHeight: Math.round(fontSize * 1.5),
            tabSize: 2,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            renderWhitespace: "selection",
            padding: { top: 12, bottom: 12 },
            glyphMargin: false,
            folding: true,
            stickyScroll: { enabled: false },
        });
        editorRef.current = editor;
        onReadyRef.current(editor);

        return () => {
            editor.dispose();
            editorRef.current = null;
            onDisposeRef.current?.();
        };
    }, [monaco]);

    useEffect(() => {
        editorRef.current?.updateOptions({
            theme: theme === "dark" ? "vs-dark" : "vs",
        });
    }, [theme]);

    useEffect(() => {
        editorRef.current?.updateOptions({
            fontSize,
            fontFamily,
            lineHeight: Math.round(fontSize * 1.5),
        });
    }, [fontSize, fontFamily]);

    return <div ref={containerRef} className="h-full w-full" />;
}
