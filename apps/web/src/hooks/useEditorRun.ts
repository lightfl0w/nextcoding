import { toast } from "@heroui/react";
import { useCallback, useMemo } from "react";
import { useRunPanel } from "~/hooks/useRunPanel";
import type { WorkFile } from "~/lib/api";
import { detectRuntime, toSources, unsupportedRuntimeMessage } from "~/lib/run";

interface EditorRunOptions {
    files: WorkFile[];
    activeKey: string | null;
    readDraft: (key: string) => string | null;
    loadContent: (key: string) => Promise<string>;
}

/**
 * 编辑页运行。
 * @param options.files - 当前文件列表。
 * @param options.activeKey - 当前焦点文件的 key。
 * @param options.readDraft - 读取某文件的草稿内容。
 * @param options.loadContent - 从服务器加载文件内容。
 * @remarks 优先运行当前焦点文件；未打开文件时退回按项目识别入口。
 */
export function useEditorRun({
    files,
    activeKey,
    readDraft,
    loadContent,
}: EditorRunOptions) {
    const {
        running,
        output,
        result,
        run,
        clear,
        isPanelOpen,
        openPanel,
        closePanel,
        awaitingInput,
        submitInput,
        cancelInput,
    } = useRunPanel();

    const activeFile = useMemo(
        () => files.find((file) => file.key === activeKey) ?? null,
        [files, activeKey],
    );

    const runtime = useMemo(() => {
        if (activeFile) {
            return detectRuntime([activeFile.name]);
        }
        return detectRuntime(files.map((file) => file.name));
    }, [activeFile, files]);

    const start = useCallback(async () => {
        if (!runtime) {
            toast.warning(
                unsupportedRuntimeMessage(
                    activeFile
                        ? [activeFile.name]
                        : files.map((file) => file.name),
                    "还没有文件可运行，请先新建文件",
                ),
            );
            return;
        }

        const sources = await collectSources(files, readDraft, loadContent);
        openPanel();
        await run(sources, runtime.entryPoint, runtime.language);
    }, [activeFile, files, runtime, readDraft, loadContent, run, openPanel]);

    return {
        runtime,
        running,
        output,
        result,
        isPanelOpen,
        start,
        closePanel,
        clear,
        awaitingInput,
        submitInput,
        cancelInput,
    };
}

async function collectSources(
    files: WorkFile[],
    readDraft: (key: string) => string | null,
    loadContent: (key: string) => Promise<string>,
): Promise<Record<string, string>> {
    const loaded = await Promise.all(
        files.map(async (file) => ({
            name: file.name,
            content: readDraft(file.key) ?? (await loadContent(file.key)),
        })),
    );
    return toSources(loaded);
}
