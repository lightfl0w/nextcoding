import type * as Monaco from "monaco-editor";
import { useCallback, useEffect, useRef } from "react";
import type { WorkFile } from "~/lib/api";
import { LARGE_FILE_BYTES, languageFromName } from "~/lib/editor";

interface MonacoDraftsOptions {
    monaco: typeof Monaco | null;
    editor: Monaco.editor.IStandaloneCodeEditor | null;
    files: WorkFile[];
    activeKey: string | null;
    activeContent: string | undefined;
}

/**
 * 编辑器模型草稿。
 * @param options.files - 当前文件列表。
 * @param options.activeKey - 当前打开的文件 key。
 * @param options.activeContent - 服务器上的文件内容。
 * @remarks 打开过的文件内容留在模型里，读草稿优先于服务器。
 */
export function useMonacoDrafts({
    monaco,
    editor,
    files,
    activeKey,
    activeContent,
}: MonacoDraftsOptions) {
    const modelsRef = useRef(new Map<string, Monaco.editor.ITextModel>());
    const filesRef = useRef(files);
    filesRef.current = files;

    useEffect(() => {
        const models = modelsRef.current;
        return () => {
            for (const model of models.values()) {
                model.dispose();
            }
            models.clear();
        };
    }, []);

    useEffect(() => {
        const liveKeys = new Set(files.map((file) => file.key));
        for (const [key, model] of modelsRef.current) {
            if (liveKeys.has(key)) {
                continue;
            }
            model.dispose();
            modelsRef.current.delete(key);
        }
    }, [files]);

    useEffect(() => {
        if (!monaco || !editor || !activeKey) {
            return;
        }

        const existing = modelsRef.current.get(activeKey);
        if (existing) {
            editor.setModel(existing);
            return;
        }

        const model = createModel(monaco, filesRef.current, activeKey);
        modelsRef.current.set(activeKey, model);
        editor.setModel(model);
    }, [monaco, editor, activeKey]);

    useEffect(() => {
        if (!monaco || !activeKey || activeContent === undefined) {
            return;
        }
        const model = modelsRef.current.get(activeKey);
        if (model) {
            fillEmptyModel(monaco, model, activeContent);
        }
    }, [activeKey, activeContent, monaco]);

    const readDraft = useCallback(
        (key: string) => modelsRef.current.get(key)?.getValue() ?? null,
        [],
    );

    const replaceDraft = useCallback((key: string, content: string) => {
        modelsRef.current.get(key)?.setValue(content);
    }, []);

    return { readDraft, replaceDraft };
}

function createModel(
    monaco: typeof Monaco,
    files: WorkFile[],
    key: string,
): Monaco.editor.ITextModel {
    const file = files.find((candidate) => candidate.key === key);

    const language =
        file && file.size > LARGE_FILE_BYTES
            ? "plaintext"
            : languageFromName(file?.name ?? "");
    return monaco.editor.createModel("", language);
}

function fillEmptyModel(
    monaco: typeof Monaco,
    model: Monaco.editor.ITextModel,
    content: string,
): void {
    if (model.isDisposed() || model.getValue() !== "") {
        return;
    }
    model.setValue(content);

    if (
        content.length > LARGE_FILE_BYTES &&
        model.getLanguageId() !== "plaintext"
    ) {
        monaco.editor.setModelLanguage(model, "plaintext");
    }
}
