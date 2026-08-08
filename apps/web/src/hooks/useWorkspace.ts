import { useCallback, useEffect, useRef } from "react";
import type * as Monaco from "monaco-editor";
import { languageFromName } from "~/lib/editor";

export interface EditorFile {
    key: string;
    name: string;
}

export function useMonacoModel(
    monaco: typeof Monaco | null,
    editor: Monaco.editor.IStandaloneCodeEditor | null,
    files: EditorFile[],
    activeKey: string | null,
    loadContent: (key: string) => Promise<string>,
) {
    const modelsRef = useRef(new Map<string, Monaco.editor.ITextModel>());
    const monacoRef = useRef(monaco);
    monacoRef.current = monaco;
    const filesRef = useRef(files);
    filesRef.current = files;
    const loadRef = useRef(loadContent);
    loadRef.current = loadContent;

    useEffect(() => {
        const models = modelsRef.current;
        return () => {
            for (const model of models.values()) model.dispose();
            models.clear();
        };
    }, []);

    useEffect(() => {
        const keys = new Set(files.map((f) => f.key));
        for (const [key, model] of modelsRef.current) {
            if (!keys.has(key)) {
                model.dispose();
                modelsRef.current.delete(key);
            }
        }
    }, [files]);

    useEffect(() => {
        if (!monaco || !editor || !activeKey) return;

        let model = modelsRef.current.get(activeKey);
        if (!model) {
            model = monaco.editor.createModel("", "plaintext");
            modelsRef.current.set(activeKey, model);
            const file = filesRef.current.find((f) => f.key === activeKey);
            if (file) {
                monaco.editor.setModelLanguage(model, languageFromName(file.name));
            }
            loadRef.current(activeKey)
                .then((content) => {
                    const m = modelsRef.current.get(activeKey);
                    if (m && !m.isDisposed() && m.getValue() === "") {
                        m.setValue(content);
                    }
                })
                .catch(() => {});
        }
        editor.setModel(model);
    }, [monaco, editor, activeKey]);

    const getContent = useCallback((key: string) => {
        return modelsRef.current.get(key)?.getValue() ?? null;
    }, []);

    const getModel = useCallback((key: string) => {
        return modelsRef.current.get(key) ?? null;
    }, []);

    return { getContent, getModel };
}
