import { Spinner } from "@heroui/react";
import {
    createFileRoute,
    useNavigate,
    useParams,
} from "@tanstack/react-router";
import type * as Monaco from "monaco-editor";
import { useTheme } from "next-themes";
import { memo, useCallback, useMemo, useRef, useState } from "react";
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
import { useEditableTitle } from "~/hooks/useEditableTitle";
import { useEditorRun } from "~/hooks/useEditorRun";
import { useEditorSettings } from "~/hooks/useEditorSettings";
import { useFileActions } from "~/hooks/useFileActions";
import { useFileContent } from "~/hooks/useFileContent";
import { useFileTabs } from "~/hooks/useFileTabs";
import { useMonaco } from "~/hooks/useMonaco";
import { useMonacoDrafts } from "~/hooks/useMonacoDrafts";
import { usePublishWork } from "~/hooks/usePublishWork";
import { useVersionHistory } from "~/hooks/useVersionHistory";
import { useWork } from "~/hooks/useWork";
import { useWorkFiles } from "~/hooks/useWorkFiles";
import { useWorkSource } from "~/hooks/useWorkRemixes";
import { fileContentPath, readFileContent } from "~/lib/api";
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
    const { fontSize, fontFamily, setFontSize, setFontFamily } =
        useEditorSettings();
    const [editor, setEditor] =
        useState<Monaco.editor.IStandaloneCodeEditor | null>(null);
    const [versionMessage, setVersionMessage] = useState("");
    const { title, setTitle, saveTitle } = useEditableTitle({
        work,
        workId,
        mutateWork,
    });

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

    const { publishWorkAction } = usePublishWork({
        workId,
        files,
        readDraft,
        mutate,
        navigate,
    });

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
    const runner = useEditorRun({
        files,
        activeKey,
        readDraft,
        loadContent,
    });
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
                if (key) {
                    scheduleSaveRef.current(key);
                }
            });
        },
        [editedKeyRef, scheduleSaveRef],
    );

    const detachEditor = useCallback(() => setEditor(null), []);

    const publish = useCallback(async () => {
        const published = await versionHistory.publish(
            versionMessage.trim() || null,
        );
        if (published) {
            setVersionMessage("");
        }
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
                fontSize={fontSize}
                fontFamily={fontFamily}
                onFontSizeChange={setFontSize}
                onFontFamilyChange={setFontFamily}
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
                            fontSize={fontSize}
                            fontFamily={fontFamily}
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
                awaitingInput={runner.awaitingInput}
                onSubmitInput={runner.submitInput}
                onCancelInput={runner.cancelInput}
                onClose={runner.closePanel}
                onClear={runner.clear}
            />
        </div>
    );
}

function EditorSurface({
    monaco,
    theme,
    fontSize,
    fontFamily,
    hasFiles,
    activeKey,
    preview,
    onExitCompare,
    onEditorReady,
    onEditorDispose,
}: {
    monaco: typeof Monaco | null;
    theme: "light" | "dark";
    fontSize: number;
    fontFamily: string;
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
                fontSize={fontSize}
                fontFamily={fontFamily}
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
            fontSize={fontSize}
            fontFamily={fontFamily}
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

function useResolvedEditorTheme(): "light" | "dark" {
    const { resolvedTheme } = useTheme();
    return resolvedTheme === "dark" ? "dark" : "light";
}
