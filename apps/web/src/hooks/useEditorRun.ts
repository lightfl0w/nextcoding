import { toast } from "@heroui/react";
import { useCallback, useMemo } from "react";
import { useRunPanel } from "~/hooks/useRunPanel";
import type { WorkFile } from "~/lib/api";
import { detectRuntime, toSources, unsupportedRuntimeMessage } from "~/lib/run";

interface EditorRunOptions {
    files: WorkFile[];
    readDraft: (key: string) => string | null;
    loadContent: (key: string) => Promise<string>;
}

export function useEditorRun({
    files,
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
    } = useRunPanel();

    const runtime = useMemo(
        () => detectRuntime(files.map((file) => file.name)),
        [files],
    );

    const start = useCallback(async () => {
        if (!runtime) {
            toast.warning(
                unsupportedRuntimeMessage(
                    files.map((file) => file.name),
                    "还没有文件可运行，请先新建文件",
                ),
            );
            return;
        }

        const sources = await collectSources(files, readDraft, loadContent);
        openPanel();
        await run(sources, runtime.entryPoint, runtime.language);
    }, [files, runtime, readDraft, loadContent, run, openPanel]);

    return {
        runtime,
        running,
        output,
        result,
        isPanelOpen,
        start,
        closePanel,
        clear,
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
