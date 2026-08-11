import type * as Monaco from "monaco-editor";
import { useEffect, useRef } from "react";

interface MonacoWrapperProps {
    monaco: typeof Monaco | null;
    theme: "light" | "dark";
    onReady: (editor: Monaco.editor.IStandaloneCodeEditor) => void;
    onDispose?: () => void;
}

/**
 * monaco 编辑器承载。
 * @param props.monaco - monaco 模块实例。
 * @param props.theme - 明暗主题。
 * @param props.onReady - 编辑器创建完成回调。
 * @param props.onDispose - 编辑器销毁回调。
 * @remarks 主题变化只更新选项，不重建编辑器实例。
 */
export function MonacoWrapper({
    monaco,
    theme,
    onReady,
    onDispose,
}: MonacoWrapperProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    const onDisposeRef = useRef(onDispose);
    onDisposeRef.current = onDispose;

    // biome-ignore lint/correctness/useExhaustiveDependencies: 主题由下方 effect 单独更新，不在此重建编辑器
    useEffect(() => {
        if (!monaco || !containerRef.current) {
            return;
        }

        const editor = monaco.editor.create(containerRef.current, {
            theme: theme === "dark" ? "vs-dark" : "vs",
            automaticLayout: true,
            fontSize: 13,
            lineHeight: 20,
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

    return <div ref={containerRef} className="h-full w-full" />;
}
