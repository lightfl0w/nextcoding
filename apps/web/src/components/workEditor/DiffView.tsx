import { Chip } from "@heroui/react";
import { X } from "lucide-react";
import type * as Monaco from "monaco-editor";
import { useEffect, useRef } from "react";

interface DiffViewProps {
    monaco: typeof Monaco | null;
    theme: "light" | "dark";
    original: string;
    modified: string;
    label: string;
    onClose: () => void;
}

export function DiffView({
    monaco,
    theme,
    original,
    modified,
    label,
    onClose,
}: DiffViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!monaco || !container) {
            return;
        }

        const originalModel = monaco.editor.createModel(original, "plaintext");
        const modifiedModel = monaco.editor.createModel(modified, "plaintext");
        const diffEditor = monaco.editor.createDiffEditor(container, {
            automaticLayout: true,
            theme: theme === "dark" ? "vs-dark" : "vs",
            readOnly: true,
        });
        diffEditor.setModel({
            original: originalModel,
            modified: modifiedModel,
        });

        return () => {
            diffEditor.dispose();
            originalModel.dispose();
            modifiedModel.dispose();
        };
    }, [monaco, original, modified, theme]);

    return (
        <div className="relative h-full w-full">
            <div ref={containerRef} className="h-full w-full" />
            <div className="absolute top-2 left-2 z-50">
                <Chip size="sm" variant="soft">
                    {label}
                </Chip>
            </div>
            <button
                type="button"
                onClick={onClose}
                title="关闭对比"
                className="absolute top-2 right-2 z-50 p-1.5 rounded-md bg-background border border-default-200 hover:bg-default-100"
            >
                <X className="size-4" />
            </button>
        </div>
    );
}
