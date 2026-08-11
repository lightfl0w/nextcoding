import { Spinner, toast } from "@heroui/react";
import {
    createFileRoute,
    useNavigate,
    useParams,
} from "@tanstack/react-router";
import type * as Monaco from "monaco-editor";
import { useTheme } from "next-themes";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSWRConfig } from "swr";

import { MonacoWrapper } from "~/components/editor/MonacoWrapper";
import { RunPanel } from "~/components/editor/RunPanel";
import { DiffView } from "~/components/workEditor/DiffView";
import { EditorHeader } from "~/components/workEditor/EditorHeader";
import { EditorTabs } from "~/components/workEditor/EditorTabs";
import { FileExplorer } from "~/components/workEditor/FileExplorer";
import { VersionHistoryPanel } from "~/components/workEditor/VersionHistoryPanel";
import { type DiffPreview, useDiffPreview } from "~/hooks/useDiffPreview";
import { useDraftSaver } from "~/hooks/useDraftSaver";
import { useEditorRun } from "~/hooks/useEditorRun";
import { useFileActions } from "~/hooks/useFileActions";
import { useFileContent } from "~/hooks/useFileContent";
import { useFileTabs } from "~/hooks/useFileTabs";
import { useMonacoDrafts } from "~/hooks/useMonacoDrafts";
import { useVersionHistory } from "~/hooks/useVersionHistory";
import { useWork } from "~/hooks/useWork";
import { useWorkFiles } from "~/hooks/useWorkFiles";
import { useWorkSource } from "~/hooks/useWorkRemixes";
import type { WorkFile } from "~/lib/api";
import {
    fileContentPath,
    publishWork,
    readFileContent,
    updateWorkTitle,
    workPath,
} from "~/lib/api";
import { loadMonaco } from "~/lib/editor";
import { languageLabel } from "~/lib/run";

export const Route = createFileRoute("/work/$id/edit")({
    component: WorkEditorRoute,
});

function WorkEditorRoute() {
    const { id: workId } = useParams({ from: "/work/$id/edit" });
    const navigate = useNavigate();
    const { data: work, mutate: mutateWork } = useWork(workId);
    const theme = useResolvedEditorTheme();
    const monaco = useMonaco();
    const [editor, setEditor] =
        useState<Monaco.editor.IStandaloneCodeEditor | null>(null);
    const [versionMessage, setVersionMessage] = useState("");
    const [title, setTitle] = useState("");

    useEffect(() => {
        if (work) setTitle(work.title);
    }, [work?.title, work]);

    const saveTitle = useCallback(async () => {
        const trimmed = title.trim();
        if (!work || !trimmed || trimmed === work.title) return;
        try {
            await updateWorkTitle(workId, trimmed);
            setTitle(trimmed);
            mutateWork(
                (current) =>
                    current ? { ...current, title: trimmed } : current,
                false,
            );
        } catch (error) {
            toast.danger((error as Error).message);
            setTitle(work.title);
        }
    }, [title, work, workId, mutateWork]);

    const { files, isLoading, reload } = useWorkFiles(workId);
    const { activeKey, openKeys, selectFile, openFile, closeFile } =
        useFileTabs(files);

    const { mutate } = useSWRConfig();
    const loadContent = useCallback(
        async (key: string) =>
            (await mutate(fileContentPath(workId, key), () =>
                readFileContent(workId, key),
            )) ?? "",
        [workId, mutate],
    );

    const { data: activeContent } = useFileContent(workId, activeKey);

    const { readDraft, replaceDraft } = useMonacoDrafts({
        monaco,
        editor,
        files,
        activeKey,
        activeContent,
    });

    const publishWorkAction = useCallback(async () => {
        if (files.length === 0) {
            toast.warning("发布前请先创建文件");
            return;
        }
        const hasContent = files.some(
            (file) => fileContentLength(file, readDraft) > 0,
        );
        if (!hasContent) {
            toast.warning("请至少在一个文件里填写内容后再发布");
            return;
        }
        try {
            await publishWork(workId);
            await mutate(workPath(workId));
            toast.success("作品已发布");
            navigate({ to: "/work/$id", params: { id: workId } });
        } catch (error) {
            toast.danger((error as Error).message);
        }
    }, [workId, navigate, files, readDraft, mutate]);

    const { dirtyKeys, isSaving, scheduleSave, trackFile, forgetFile } =
        useDraftSaver({
            workId,
            files,
            readDraft,
            replaceDraft,
            loadContent,
        });

    const diff = useDiffPreview({ workId, activeKey, readDraft });
    const versionHistory = useVersionHistory(workId);
    const runner = useEditorRun({ files, readDraft, loadContent });
    const source = useWorkSource(workId);

    const runLabel = useMemo(
        () =>
            runner.runtime
                ? `${languageLabel(runner.runtime.language)} ${runner.runtime.entryPoint}`
                : null,
        [runner.runtime],
    );

    const fileActions = useFileActions({
        workId,
        reload,
        onFileCreated: useCallback(
            (key: string, version: number) => {
                trackFile(key, version);
                openFile(key);
            },
            [trackFile, openFile],
        ),
        onFileRemoved: useCallback(
            (key: string) => {
                forgetFile(key);
                diff.close();
                closeFile(key);
            },
            [forgetFile, diff.close, closeFile],
        ),
    });

    const openFiles = useMemo(
        () => files.filter((file) => openKeys.has(file.key)),
        [files, openKeys],
    );

    const editedKeyRef = useLatestRef(activeKey);
    const scheduleSaveRef = useLatestRef(scheduleSave);

    const attachEditor = useCallback(
        (instance: Monaco.editor.IStandaloneCodeEditor) => {
            setEditor(instance);
            instance.onDidChangeModelContent(() => {
                const key = editedKeyRef.current;
                if (key) scheduleSaveRef.current(key);
            });
        },
        [editedKeyRef, scheduleSaveRef],
    );

    const detachEditor = useCallback(() => setEditor(null), []);

    const publish = useCallback(async () => {
        const published = await versionHistory.publish(
            versionMessage.trim() || null,
        );
        if (published) setVersionMessage("");
    }, [versionHistory.publish, versionMessage]);

    if (isLoading) {
        return (
            <div className="h-full w-full flex items-center justify-center">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="h-screen w-full flex flex-col bg-background">
            <EditorHeader
                fileCount={files.length}
                isSaving={isSaving}
                isRunning={runner.running}
                isComparing={diff.preview !== null}
                title={title}
                isPublished={work?.status === "published"}
                versionMessage={versionMessage}
                source={source}
                onTitleChange={setTitle}
                onTitleSave={saveTitle}
                onVersionMessageChange={setVersionMessage}
                onExitCompare={diff.close}
                onRun={runner.start}
                onPublishVersion={publish}
                onPublishWork={publishWorkAction}
            />

            <div className="flex-1 flex min-h-0">
                <FileExplorer
                    files={files}
                    activeKey={activeKey}
                    isComposing={fileActions.isComposing}
                    draftName={fileActions.draftName}
                    nameError={fileActions.nameError}
                    onOpenFile={openFile}
                    onDeleteFile={fileActions.removeFile}
                    onStartComposing={fileActions.startComposing}
                    onCancelComposing={fileActions.cancelComposing}
                    onChangeDraftName={fileActions.changeDraftName}
                    onConfirmComposing={fileActions.confirmComposing}
                />

                <div className="flex-1 flex flex-col min-w-0">
                    <EditorTabs
                        files={openFiles}
                        activeKey={activeKey}
                        dirtyKeys={dirtyKeys}
                        onSelect={selectFile}
                        onClose={closeFile}
                    />
                    <div className="flex-1 min-h-0">
                        <MemoEditorSurface
                            monaco={monaco}
                            theme={theme}
                            hasFiles={files.length > 0}
                            activeKey={activeKey}
                            preview={diff.preview}
                            onExitCompare={diff.close}
                            onEditorReady={attachEditor}
                            onEditorDispose={detachEditor}
                        />
                    </div>
                </div>

                <VersionHistoryPanel
                    versions={versionHistory.versions}
                    onCompare={diff.compareWith}
                    onRestore={versionHistory.restore}
                />
            </div>

            <RunPanel
                open={runner.isPanelOpen}
                running={runner.running}
                output={runner.output}
                result={runner.result}
                label={runLabel}
                onClose={runner.closePanel}
                onClear={runner.clear}
            />
        </div>
    );
}

function EditorSurface({
    monaco,
    theme,
    hasFiles,
    activeKey,
    preview,
    onExitCompare,
    onEditorReady,
    onEditorDispose,
}: {
    monaco: typeof Monaco | null;
    theme: "light" | "dark";
    hasFiles: boolean;
    activeKey: string | null;
    preview: DiffPreview | null;
    onExitCompare: () => void;
    onEditorReady: (editor: Monaco.editor.IStandaloneCodeEditor) => void;
    onEditorDispose: () => void;
}) {
    if (!hasFiles || activeKey === null) {
        return (
            <div className="h-full w-full flex items-center justify-center text-sm text-foreground/50">
                {hasFiles
                    ? "没有打开的标签页，点左侧文件打开"
                    : "暂无文件，点左侧「+」新建"}
            </div>
        );
    }

    if (preview) {
        return (
            <DiffView
                monaco={monaco}
                theme={theme}
                original={preview.original}
                modified={preview.modified}
                label={`v${preview.version}（对比当前草稿）`}
                onClose={onExitCompare}
            />
        );
    }

    return (
        <MonacoWrapper
            monaco={monaco}
            theme={theme}
            onReady={onEditorReady}
            onDispose={onEditorDispose}
        />
    );
}

const MemoEditorSurface = memo(EditorSurface);

function useLatestRef<T>(value: T) {
    const ref = useRef(value);
    ref.current = value;
    return ref;
}

function fileContentLength(
    file: WorkFile,
    readDraft: (key: string) => string | null,
): number {
    const draft = readDraft(file.key);
    return draft === null ? file.size : draft.length;
}

function useMonaco() {
    const [monaco, setMonaco] = useState<typeof Monaco | null>(null);

    useEffect(() => {
        let subscribed = true;
        loadMonaco().then((instance) => {
            if (subscribed) setMonaco(instance);
        });
        return () => {
            subscribed = false;
        };
    }, []);

    return monaco;
}

function useResolvedEditorTheme(): "light" | "dark" {
    const { resolvedTheme } = useTheme();
    return resolvedTheme === "dark" ? "dark" : "light";
}
