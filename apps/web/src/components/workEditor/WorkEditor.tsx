import {
    AlertDialog,
    Button,
    Spinner,
    toast,
    useOverlayState,
} from "@heroui/react";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import {
    FileCode,
    Files,
    History,
    PanelLeftClose,
    PanelLeftOpen,
} from "lucide-react";
import type * as Monaco from "monaco-editor";
import { useTheme } from "next-themes";
import {
    memo,
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useSWRConfig } from "swr";
import { toBlob } from "html-to-image";

import { ImageCropModal } from "~/components/ImageCropModal";
import { MonacoWrapper } from "~/components/editor/MonacoWrapper";
import { RunPanel } from "~/components/editor/RunPanel";
import { DiffView } from "~/components/workEditor/DiffView";
import { EditorHeader } from "~/components/workEditor/EditorHeader";
import { EditorTabs } from "~/components/workEditor/EditorTabs";
import { FileExplorer } from "~/components/workEditor/FileExplorer";
import { PushToRemoteDialog } from "~/components/workEditor/PushToRemoteDialog";
import { PublishWorkDialog } from "~/components/workEditor/PublishWorkDialog";
import { VersionCompareDialog } from "~/components/workEditor/VersionCompareDialog";
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
import { usePendingFiles } from "~/hooks/usePendingFiles";
import { usePersistPendingWork } from "~/hooks/usePersistPendingWork";
import { usePublishWork } from "~/hooks/usePublishWork";
import { useVersionHistory } from "~/hooks/useVersionHistory";
import { useWork } from "~/hooks/useWork";
import { useWorkFiles } from "~/hooks/useWorkFiles";
import { useWorkSource } from "~/hooks/useWorkRemixes";
import {
    fileContentPath,
    readFileContent,
    uploadWorkCover,
    updateWorkCover,
} from "~/lib/api";
import { downloadWorkAsGit } from "~/lib/api/git";
import { languageLabel } from "~/lib/run";

const AUTO_SNAPSHOT_INTERVAL_MS = 5 * 60_000;

/**
 * 作品编辑器。
 * @param props.workId - 作品 ID；`null` 表示待创建模式：
 * 作品尚未在服务器创建，文件只存在浏览器内存，
 * 点「保存草稿」（或「发布」）时才创建作品并持久化。
 */
export function WorkEditor({ workId }: { workId: string | null }) {
    const navigate = useNavigate();
    const pending = usePendingFiles();
    const { data: work, mutate: mutateWork } = useWork(workId);
    const theme = useResolvedEditorTheme();
    const monaco = useMonaco();
    const {
        fontSize,
        fontFamily,
        autoSaveDraft,
        autoSnapshot,
        setFontSize,
        setFontFamily,
        setAutoSaveDraft,
        setAutoSnapshot,
    } = useEditorSettings();
    const [editor, setEditor] =
        useState<Monaco.editor.IStandaloneCodeEditor | null>(null);
    const { title, setTitle, saveTitle } = useEditableTitle({
        work,
        workId,
        mutateWork,
    });

    const coverUrl = work?.coverUrl ?? null;
    const [coverUploading, setCoverUploading] = useState(false);
    const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(
        null,
    );
    const runPanelRef = useRef<HTMLDivElement | null>(null);

    const saveCover = useCallback(
        async (url: string | null): Promise<boolean> => {
            if (workId === null) {
                return false;
            }
            await updateWorkCover(workId, url);
            await mutateWork(
                (current) =>
                    current ? { ...current, coverUrl: url } : current,
                { revalidate: false },
            );
            return true;
        },
        [workId, mutateWork],
    );

    const handlePickCover = useCallback((file: File) => {
        setPendingCoverFile(file);
    }, []);

    const handleCropCover = useCallback(
        async (croppedFile: File) => {
            if (workId === null) {
                toast.danger("请先保存草稿以创建作品，再设置封面");
                setPendingCoverFile(null);
                return;
            }
            setCoverUploading(true);
            try {
                const { url } = await uploadWorkCover(croppedFile);
                await saveCover(url);
                toast.success("封面已更新");
            } catch (error) {
                toast.danger(
                    (error as Error).message || "封面保存失败",
                );
            } finally {
                setCoverUploading(false);
                setPendingCoverFile(null);
            }
        },
        [workId, saveCover],
    );

    const handleRemoveCover = useCallback(async () => {
        if (workId === null) {
            return;
        }
        setCoverUploading(true);
        try {
            await saveCover(null);
            toast.success("已移除封面");
        } catch (error) {
            toast.danger((error as Error).message || "移除封面失败");
        } finally {
            setCoverUploading(false);
        }
    }, [workId, saveCover]);

    const serverFiles = useWorkFiles(workId);
    const files = workId === null ? pending.workFiles : serverFiles.files;
    const isLoading = workId !== null && serverFiles.isLoading;
    const reload = serverFiles.reload;
    const { activeKey, openKeys, selectFile, openFile, closeFile } =
        useFileTabs(files);

    const { mutate } = useSWRConfig();
    const loadContent = useCallback(
        async (key: string) => {
            if (workId === null) {
                return pending.readContent(key) ?? "";
            }
            return (
                (await mutate(fileContentPath(workId, key), () =>
                    readFileContent(workId, key),
                )) ?? ""
            );
        },
        [workId, pending.readContent, mutate],
    );

    const { data: activeContent } = useFileContent(workId, activeKey);

    const { readDraft, replaceDraft } = useMonacoDrafts({
        monaco,
        editor,
        files,
        activeKey,
        activeContent,
    });

    const { persist: persistPendingWork, persistingRef } =
        usePersistPendingWork({
            title,
            files: pending.files,
            readDraft,
            readContent: pending.readContent,
        });

    const { publishWorkAction } = usePublishWork({
        workId,
        files,
        readDraft,
        mutate,
        navigate,
        persistPending: useCallback(
            () => persistPendingWork(null),
            [persistPendingWork],
        ),
    });

    const publishDialogState = useOverlayState();
    const [publishing, setPublishing] = useState(false);

    const handlePublishConfirm = useCallback(
        async (values: {
            title: string;
            description: string | null;
            tags: string[];
        }) => {
            setPublishing(true);
            try {
                const ok = await publishWorkAction(values);
                if (ok) {
                    publishDialogState.close();
                }
            } finally {
                setPublishing(false);
            }
        },
        [publishWorkAction, publishDialogState],
    );

    const {
        dirtyKeys,
        isSaving,
        scheduleSave,
        trackFile,
        forgetFile,
        flushSave,
    } = useDraftSaver({
        workId,
        files,
        readDraft,
        replaceDraft,
        loadContent,
        autoSave: autoSaveDraft,
    });

    const collectTree = useCallback(async (): Promise<
        Record<string, string>
    > => {
        const entries = await Promise.all(
            files.map(async (file) => {
                const content =
                    readDraft(file.key) ?? (await loadContent(file.key));
                return [file.name, content] as const;
            }),
        );
        return Object.fromEntries(entries);
    }, [files, readDraft, loadContent]);

    const diff = useDiffPreview({ workId, activeKey, readDraft });
    const versionHistory = useVersionHistory(workId);
    const compareDialogState = useOverlayState();
    const pushDialogState = useOverlayState();
    const [isGitBusy, setIsGitBusy] = useState(false);
    const [sidebarTab, setSidebarTab] = useState<"files" | "versions">("files");
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const toggleSidebar = useCallback(
        (tab: "files" | "versions") => {
            if (sidebarOpen && sidebarTab === tab) {
                setSidebarOpen(false);
            } else {
                setSidebarTab(tab);
                setSidebarOpen(true);
            }
        },
        [sidebarOpen, sidebarTab],
    );
    const runner = useEditorRun({
        files,
        activeKey,
        readDraft,
        loadContent,
    });

    const handleCaptureRunCover = useCallback(async () => {
        if (workId === null) {
            toast.danger("请先保存草稿以创建作品，再设置封面");
            return;
        }
        if (!runner.isPanelOpen) {
            toast.danger("请先运行程序，再截取运行画面");
            return;
        }
        const node = runPanelRef.current;
        if (!node) {
            toast.danger("运行面板尚未就绪");
            return;
        }
        setCoverUploading(true);
        try {
            const blob = await toBlob(node, {
                pixelRatio: 2,
                cacheBust: true,
                backgroundColor: "#0b0b0c",
            });
            if (!blob) {
                throw new Error("截图失败，请重试");
            }
            const file = new File([blob], "run-cover.png", {
                type: "image/png",
            });
            const { url } = await uploadWorkCover(file);
            await saveCover(url);
            toast.success("封面已更新");
        } catch (error) {
            toast.danger((error as Error).message || "截图失败");
        } finally {
            setCoverUploading(false);
        }
    }, [workId, runner.isPanelOpen, saveCover]);

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
        flushDraft: flushSave,
        local:
            workId === null
                ? {
                      create: pending.createFile,
                      rename: pending.renameFile,
                      remove: pending.removeFile,
                      removeFolder: pending.removeFolder,
                  }
                : undefined,
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
        onFileRenamed: useCallback(
            (oldKey: string, newKey: string, version: number) => {
                diff.close();
                closeFile(oldKey);
                forgetFile(oldKey);
                trackFile(newKey, version);
                openFile(newKey);
            },
            [diff.close, closeFile, forgetFile, trackFile, openFile],
        ),
        onFolderRemoved: useCallback(
            (folder: string) => {
                const prefix = `${folder}/`;
                for (const key of [...openKeys]) {
                    if (!key.startsWith(prefix)) {
                        continue;
                    }
                    forgetFile(key);
                    closeFile(key);
                }
                diff.close();
            },
            [openKeys, forgetFile, closeFile, diff.close],
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

    const handleSaveDraft = useCallback(
        async (message: string) => {
            const trimmed = message.trim() || null;
            if (workId === null) {
                const newId = await persistPendingWork(trimmed);
                if (newId !== null) {
                    navigate({
                        to: "/work/$id/edit",
                        params: { id: newId },
                        replace: true,
                    });
                }
                return;
            }
            const tree = await collectTree();
            const outcome = await versionHistory.publish(trimmed, tree);
            if (outcome && "conflict" in outcome) {
                await Promise.all([reload(), versionHistory.refresh()]);
            }
        },
        [
            workId,
            persistPendingWork,
            navigate,
            collectTree,
            versionHistory.publish,
            versionHistory.refresh,
            reload,
        ],
    );

    const shouldBlock = useCallback(
        () => workId === null && pending.hasFiles && !persistingRef.current,
        [workId, pending.hasFiles, persistingRef.current],
    );

    const lastAutoSnapshotRef = useRef(0);
    const prevSavingRef = useRef(isSaving);
    useEffect(() => {
        const finishedSaving = prevSavingRef.current && !isSaving;
        prevSavingRef.current = isSaving;
        if (!finishedSaving || !autoSnapshot || workId === null) {
            return;
        }
        const now = Date.now();
        if (now - lastAutoSnapshotRef.current < AUTO_SNAPSHOT_INTERVAL_MS) {
            return;
        }
        lastAutoSnapshotRef.current = now;
        const date = new Date(now);
        const hh = String(date.getHours()).padStart(2, "0");
        const mm = String(date.getMinutes()).padStart(2, "0");
        void (async () => {
            const tree = await collectTree();
            await versionHistory.publish(`自动快照 ${hh}:${mm}`, tree);
        })();
    }, [isSaving, autoSnapshot, workId, versionHistory.publish, collectTree]);

    const handleExportGit = useCallback(async () => {
        if (workId === null) {
            return;
        }
        setIsGitBusy(true);
        try {
            await downloadWorkAsGit(workId);
            toast.success("Git 仓库已下载");
        } catch (error) {
            toast.danger((error as Error).message || "导出失败");
        } finally {
            setIsGitBusy(false);
        }
    }, [workId]);

    const blocker = useBlocker({
        shouldBlockFn: shouldBlock,
        enableBeforeUnload: true,
        withResolver: true,
    });
    const blocked = blocker.status === "blocked";

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
                source={source}
                onTitleChange={setTitle}
                onTitleSave={saveTitle}
                onExitCompare={diff.close}
                onRun={runner.start}
                onSaveDraft={handleSaveDraft}
                onPublishWork={publishDialogState.open}
                fontSize={fontSize}
                fontFamily={fontFamily}
                autoSaveDraft={autoSaveDraft}
                autoSnapshot={autoSnapshot}
                coverUrl={coverUrl}
                coverUploading={coverUploading}
                onFontSizeChange={setFontSize}
                onFontFamilyChange={setFontFamily}
                onAutoSaveDraftChange={setAutoSaveDraft}
                onAutoSnapshotChange={setAutoSnapshot}
                onPickCover={handlePickCover}
                onCaptureRunCover={handleCaptureRunCover}
                onRemoveCover={handleRemoveCover}
            />

            <div className="flex-1 flex min-h-0">
                <div className="w-11 shrink-0 border-r border-default-200 bg-surface flex flex-col items-center gap-1 py-2">
                    <SidebarTab
                        active={sidebarOpen && sidebarTab === "files"}
                        icon={<Files className="size-4" />}
                        label="文件"
                        onClick={() => toggleSidebar("files")}
                    />
                    <SidebarTab
                        active={sidebarOpen && sidebarTab === "versions"}
                        icon={<History className="size-4" />}
                        label="版本"
                        onClick={() => toggleSidebar("versions")}
                    />
                    <div className="flex-1" />
                    <button
                        type="button"
                        onClick={() => setSidebarOpen((open) => !open)}
                        title={sidebarOpen ? "折叠侧边栏" : "展开侧边栏"}
                        aria-label={sidebarOpen ? "折叠侧边栏" : "展开侧边栏"}
                        className="flex items-center justify-center size-8 rounded-md text-foreground/60 hover:bg-hover hover:text-foreground"
                    >
                        {sidebarOpen ? (
                            <PanelLeftClose className="size-4" />
                        ) : (
                            <PanelLeftOpen className="size-4" />
                        )}
                    </button>
                </div>
                {sidebarOpen && (
                    <div className="w-64 shrink-0 border-r border-default-200 bg-surface flex flex-col min-h-0">
                        <div className="px-2.5 py-1.5 border-b border-default-200 shrink-0 text-xs font-medium text-foreground/70">
                            {sidebarTab === "files" ? "文件" : "版本"}
                        </div>
                        <div className="flex-1 min-h-0 flex flex-col">
                            {sidebarTab === "files" ? (
                                <FileExplorer
                                    files={files}
                                    activeKey={activeKey}
                                    isComposing={fileActions.isComposing}
                                    draftName={fileActions.draftName}
                                    nameError={fileActions.nameError}
                                    renamingKey={fileActions.renamingKey}
                                    renameDraft={fileActions.renameDraft}
                                    onOpenFile={openFile}
                                    onDeleteFile={fileActions.removeFile}
                                    onDeleteFolder={fileActions.removeFolder}
                                    onStartComposing={
                                        fileActions.startComposing
                                    }
                                    onCancelComposing={
                                        fileActions.cancelComposing
                                    }
                                    onChangeDraftName={
                                        fileActions.changeDraftName
                                    }
                                    onConfirmComposing={
                                        fileActions.confirmComposing
                                    }
                                    onStartRename={fileActions.startRename}
                                    onCancelRename={fileActions.cancelRename}
                                    onChangeRenameDraft={
                                        fileActions.changeRenameDraft
                                    }
                                    onConfirmRename={fileActions.confirmRename}
                                />
                            ) : (
                                <VersionHistoryPanel
                                    versions={versionHistory.versions}
                                    onCompare={diff.compareWith}
                                    onRestore={versionHistory.restore}
                                    onRemove={versionHistory.remove}
                                    onRename={versionHistory.rename}
                                    onCompareVersions={() => {
                                        if (workId !== null) {
                                            compareDialogState.open();
                                        }
                                    }}
                                    onExportGit={() => void handleExportGit()}
                                    onPushRemote={() => {
                                        if (workId !== null) {
                                            pushDialogState.open();
                                        }
                                    }}
                                    isBusy={isGitBusy}
                                />
                            )}
                        </div>
                    </div>
                )}

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

                <RunPanel
                    placement="right"
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
                    mode={runner.mode}
                    terminalId={runner.terminalId}
                    canvasId={runner.canvasId}
                    onStop={runner.stop}
                    loadStage={runner.loadStage}
                    loopHint={runner.loopHint}
                    panelRef={runPanelRef}
                />
            </div>

            {workId !== null && (
                <VersionCompareDialog
                    state={compareDialogState}
                    workId={workId}
                    versions={versionHistory.versions}
                    monaco={monaco}
                    theme={theme}
                    fontSize={fontSize}
                    fontFamily={fontFamily}
                />
            )}

            {workId !== null && (
                <PushToRemoteDialog state={pushDialogState} workId={workId} />
            )}

            <LeaveDraftDialog
                blocked={blocked}
                onStay={() => blocker.reset?.()}
                onLeave={() => blocker.proceed?.()}
            />

            <ImageCropModal
                file={pendingCoverFile}
                title="裁剪封面"
                aspect={4 / 3}
                cropShape="rect"
                outputWidth={1280}
                outputHeight={960}
                fileName="cover.png"
                onCrop={handleCropCover}
                onCancel={() => setPendingCoverFile(null)}
            />

            {publishDialogState.isOpen && (
                <PublishWorkDialog
                    open={publishDialogState.isOpen}
                    submitting={publishing}
                    initial={{
                        title: work?.title ?? title,
                        description: work?.description ?? null,
                        tags: work?.tags ?? [],
                        coverUrl: work?.coverUrl ?? null,
                    }}
                    coverUploading={coverUploading}
                    onPickCover={handlePickCover}
                    onCaptureRunCover={handleCaptureRunCover}
                    onRemoveCover={handleRemoveCover}
                    onCancel={publishDialogState.close}
                    onConfirm={handlePublishConfirm}
                />
            )}
        </div>
    );
}

/**
 * 左侧栏页签按钮。
 * @param props.active - 是否选中。
 * @param props.icon - 图标。
 * @param props.label - 文案。
 * @param props.onClick - 点击切换。
 */
function SidebarTab({
    active,
    icon,
    label,
    onClick,
}: {
    active: boolean;
    icon: ReactNode;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className={`flex items-center justify-center size-8 rounded-md transition-colors ${
                active
                    ? "bg-primary-100 text-primary"
                    : "text-foreground/60 hover:bg-hover hover:text-foreground"
            }`}
        >
            {icon}
        </button>
    );
}

function LeaveDraftDialog({
    blocked,
    onStay,
    onLeave,
}: {
    blocked: boolean;
    onStay: () => void;
    onLeave: () => void;
}) {
    return (
        <AlertDialog isOpen={blocked} onOpenChange={onStay}>
            <AlertDialog.Backdrop>
                <AlertDialog.Container>
                    <AlertDialog.Dialog className="sm:max-w-100">
                        <AlertDialog.CloseTrigger />
                        <AlertDialog.Header>
                            <AlertDialog.Icon status="warning" />
                            <AlertDialog.Heading>
                                放弃未保存的内容？
                            </AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <p>
                                作品尚未创建，离开后未保存的代码会丢失。确定要离开吗？
                            </p>
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button
                                slot="close"
                                variant="tertiary"
                                onPress={onStay}
                            >
                                继续编辑
                            </Button>
                            <Button
                                slot="close"
                                variant="danger"
                                onPress={onLeave}
                            >
                                仍要离开
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </AlertDialog>
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
            <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-foreground/45">
                <FileCode className="size-7" strokeWidth={1.5} />
                <p className="text-sm">
                    {hasFiles
                        ? "没有打开的标签页，点左侧文件打开"
                        : "暂无文件，点左侧「+」新建"}
                </p>
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
