import {
    AlertDialog,
    Button,
    Chip,
    Input,
    Label,
    ListBox,
    Select,
    Spinner,
    TextArea,
    Tooltip,
    toast,
} from "@heroui/react";
import {
    createFileRoute,
    Link,
    useBlocker,
    useNavigate,
} from "@tanstack/react-router";
import {
    ArrowLeft,
    Camera,
    FileCode,
    FilePlus2,
    Files,
    PanelLeftClose,
    PanelLeftOpen,
    Play,
    Send,
    Settings2,
} from "lucide-react";
import type * as Monaco from "monaco-editor";
import { useTheme } from "next-themes";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { MonacoWrapper } from "~/components/editor/MonacoWrapper";
import { RunPanel } from "~/components/editor/RunPanel";
import { ImageCropModal } from "~/components/ImageCropModal";
import { SignInPrompt } from "~/components/ui/SignInPrompt";
import { EditorTabs } from "~/components/workEditor/EditorTabs";
import { FileExplorer } from "~/components/workEditor/FileExplorer";
import { useAuth } from "~/hooks/useAuth";
import { useEditorRun } from "~/hooks/useEditorRun";
import {
    EDITOR_FONT_OPTIONS,
    EDITOR_FONT_SIZE_MAX,
    EDITOR_FONT_SIZE_MIN,
    useEditorSettings,
} from "~/hooks/useEditorSettings";
import { useFileActions } from "~/hooks/useFileActions";
import { useFileTabs } from "~/hooks/useFileTabs";
import { useMonaco } from "~/hooks/useMonaco";
import { useMonacoDrafts } from "~/hooks/useMonacoDrafts";
import { usePendingFiles } from "~/hooks/usePendingFiles";
import {
    createTemplate,
    type TemplateFileInput,
    uploadTemplateCover,
} from "~/lib/api/templates";
import { languageLabel } from "~/lib/run";
import { TEMPLATE_CATEGORIES } from "~/lib/templateCategories";

export const Route = createFileRoute("/templates/new")({
    component: NewTemplatePage,
});

/**
 * 创建模板页：与作品编辑器一致的 IDE 布局，点击「提交审核」后
 * 在弹窗中填写描述、分类与标签。
 */
function NewTemplatePage() {
    const { user, isPending } = useAuth();

    if (isPending) {
        return (
            <div className="h-screen w-full flex items-center justify-center">
                <Spinner />
            </div>
        );
    }
    if (!user) {
        return (
            <SignInPrompt
                title="登录后创建模板"
                hint="模板由你创作并提交，审核通过后上架模板市场"
                redirect="/templates/new"
            />
        );
    }
    return <NewTemplateForm />;
}

function NewTemplateForm() {
    const navigate = useNavigate();
    const pending = usePendingFiles();
    const files = pending.workFiles;
    const { activeKey, openKeys, selectFile, openFile, closeFile } =
        useFileTabs(files);
    const monaco = useMonaco();
    const { resolvedTheme } = useTheme();
    const { fontSize, fontFamily, setFontSize, setFontFamily } =
        useEditorSettings();
    const [editor, setEditor] =
        useState<Monaco.editor.IStandaloneCodeEditor | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState<string>(TEMPLATE_CATEGORIES[0].id);
    const [tagsInput, setTagsInput] = useState("");
    const [coverUrl, setCoverUrl] = useState("");
    const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
    const [coverUploading, setCoverUploading] = useState(false);
    const [publishOpen, setPublishOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const submittedRef = useRef(false);

    const noopReload = useCallback(async () => undefined, []);
    const noopFlush = useCallback(async () => undefined, []);

    const { readDraft } = useMonacoDrafts({
        monaco,
        editor,
        files,
        activeKey,
        activeContent: undefined,
    });

    const loadContent = useCallback(
        async (key: string) => pending.readContent(key) ?? "",
        [pending.readContent],
    );

    const runner = useEditorRun({
        files,
        activeKey,
        readDraft,
        loadContent,
    });

    const runLabel = useMemo(
        () =>
            runner.runtime
                ? `${languageLabel(runner.runtime.language)} ${runner.runtime.entryPoint}`
                : null,
        [runner.runtime],
    );

    const fileActions = useFileActions({
        workId: null,
        reload: noopReload,
        flushDraft: noopFlush,
        local: {
            create: pending.createFile,
            rename: pending.renameFile,
            remove: pending.removeFile,
            removeFolder: pending.removeFolder,
        },
        onFileCreated: useCallback((key: string) => openFile(key), [openFile]),
        onFileRemoved: useCallback(
            (key: string) => closeFile(key),
            [closeFile],
        ),
        onFileRenamed: useCallback(
            (oldKey: string, newKey: string) => {
                closeFile(oldKey);
                openFile(newKey);
            },
            [closeFile, openFile],
        ),
        onFolderRemoved: useCallback(
            (folder: string) => {
                const prefix = `${folder}/`;
                for (const key of [...openKeys]) {
                    if (key.startsWith(prefix)) {
                        closeFile(key);
                    }
                }
            },
            [openKeys, closeFile],
        ),
    });

    const openFiles = useMemo(
        () => files.filter((file) => openKeys.has(file.key)),
        [files, openKeys],
    );

    const openPublishDialog = useCallback(() => {
        if (!title.trim()) {
            toast.danger("请填写模板标题");
            return;
        }
        if (files.length === 0) {
            toast.danger("请至少添加一个模板文件");
            return;
        }
        setPublishOpen(true);
    }, [title, files.length]);

    const confirmPublish = useCallback(async () => {
        const trimmedTitle = title.trim();
        if (!trimmedTitle || files.length === 0) {
            setPublishOpen(false);
            return;
        }
        if (!coverUrl) {
            toast.danger("请上传模板封面");
            return;
        }
        if (coverUploading) {
            return;
        }
        setSubmitting(true);
        try {
            const templateFiles: TemplateFileInput[] = files.map((file) => ({
                name: file.name,
                content:
                    readDraft(file.key) ?? pending.readContent(file.key) ?? "",
            }));
            const tags = tagsInput
                .split(/[,，\s]+/)
                .map((tag) => tag.trim())
                .filter(Boolean)
                .slice(0, 20);
            const result = await createTemplate({
                title: trimmedTitle,
                description: description.trim() || undefined,
                category,
                tags,
                coverUrl,
                files: templateFiles,
            });
            submittedRef.current = true;
            setPublishOpen(false);
            toast.success("模板已提交审核，通过后即可被使用");
            navigate({
                to: "/templates/$id",
                params: { id: result.template.id },
            });
        } catch (error) {
            toast.danger((error as Error).message);
        } finally {
            setSubmitting(false);
        }
    }, [
        title,
        description,
        category,
        tagsInput,
        coverUrl,
        coverUploading,
        files,
        readDraft,
        navigate,
        pending.readContent,
    ]);

    const shouldBlock = useCallback(
        () => files.length > 0 && !submitting && !submittedRef.current,
        [files.length, submitting],
    );
    const blocker = useBlocker({
        shouldBlockFn: shouldBlock,
        enableBeforeUnload: true,
        withResolver: true,
    });
    const blocked = blocker.status === "blocked";

    const hasEditorContent = files.length > 0 && activeKey !== null;

    return (
        <div className="h-screen w-full flex flex-col bg-background">
            <header className="flex items-center gap-2 border-b border-default-200 px-4 py-2 shrink-0">
                <Tooltip>
                    <Tooltip.Trigger>
                        <Link
                            to="/templates"
                            aria-label="返回模板市场"
                            className="flex items-center justify-center size-8 rounded-lg text-foreground/60 hover:bg-hover hover:text-foreground shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        >
                            <ArrowLeft className="size-4" />
                        </Link>
                    </Tooltip.Trigger>
                    <Tooltip.Content placement="bottom">
                        返回模板市场
                    </Tooltip.Content>
                </Tooltip>
                <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.currentTarget.blur();
                        }
                    }}
                    placeholder="模板标题"
                    maxLength={80}
                    aria-label="模板标题"
                    variant="secondary"
                    className="w-44 shrink-0"
                />
                <Chip size="sm" variant="soft" className="shrink-0">
                    {files.length} 个文件
                </Chip>
                <div className="flex-1" />
                <TemplateSettingsMenu
                    fontSize={fontSize}
                    fontFamily={fontFamily}
                    onFontSizeChange={setFontSize}
                    onFontFamilyChange={setFontFamily}
                />
                <Button
                    size="sm"
                    variant="primary"
                    className="gap-1.5"
                    isDisabled={runner.running}
                    onPress={runner.start}
                >
                    <Play className="size-3.5" />
                    {runner.running ? "运行中…" : "运行"}
                </Button>
                <Button
                    variant="primary"
                    className="gap-1.5 shrink-0"
                    onPress={openPublishDialog}
                >
                    <Send className="size-4" />
                    提交审核
                </Button>
            </header>

            <div className="flex-1 flex min-h-0">
                <div className="w-11 shrink-0 border-r border-default-200 bg-surface flex flex-col items-center gap-1 py-2">
                    <SidebarTab
                        active={sidebarOpen}
                        icon={<Files className="size-4" />}
                        label="文件"
                        onClick={() => setSidebarOpen((open) => !open)}
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
                        <div className="px-2.5 py-1.5 border-b border-default-200 shrink-0 flex items-center justify-between">
                            <span className="text-xs font-medium text-foreground/70">
                                模板文件
                            </span>
                            <span className="text-xs text-foreground/40">
                                {files.length}
                            </span>
                        </div>
                        <div className="flex-1 min-h-0 flex flex-col">
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
                                onStartComposing={fileActions.startComposing}
                                onCancelComposing={fileActions.cancelComposing}
                                onChangeDraftName={fileActions.changeDraftName}
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
                        </div>
                    </div>
                )}

                <div className="flex-1 flex flex-col min-w-0">
                    <EditorTabs
                        files={openFiles}
                        activeKey={activeKey}
                        dirtyKeys={EMPTY_KEYS}
                        onSelect={selectFile}
                        onClose={closeFile}
                    />
                    <div className="flex-1 min-h-0">
                        {!hasEditorContent ? (
                            <div className="h-full flex flex-col items-center justify-center gap-4 text-foreground/45">
                                <div className="size-16 rounded-full bg-default-100 flex items-center justify-center">
                                    <FileCode
                                        className="size-7 text-foreground/40"
                                        strokeWidth={1.5}
                                    />
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <p className="text-sm font-medium text-foreground/70">
                                        还没有模板文件
                                    </p>
                                    <p className="text-xs text-foreground/40">
                                        从左侧新建文件，开始编写模板内容
                                    </p>
                                </div>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="gap-1.5"
                                    onPress={fileActions.startComposing}
                                >
                                    <FilePlus2 className="size-4" />
                                    新建文件
                                </Button>
                            </div>
                        ) : (
                            <MonacoWrapper
                                monaco={monaco}
                                theme={
                                    resolvedTheme === "dark" ? "dark" : "light"
                                }
                                fontSize={fontSize}
                                fontFamily={fontFamily}
                                onReady={setEditor}
                            />
                        )}
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
                />
            </div>

            <PublishDialog
                open={publishOpen}
                submitting={submitting}
                description={description}
                category={category}
                tagsInput={tagsInput}
                coverUrl={coverUrl}
                coverUploading={coverUploading}
                onDescriptionChange={setDescription}
                onCategoryChange={setCategory}
                onTagsChange={setTagsInput}
                onPickCover={setPendingCoverFile}
                onCancel={() => setPublishOpen(false)}
                onConfirm={confirmPublish}
            />

            <ImageCropModal
                file={pendingCoverFile}
                title="裁剪封面"
                aspect={16 / 9}
                cropShape="rect"
                outputWidth={1280}
                outputHeight={720}
                fileName="cover.png"
                onCrop={async (croppedFile) => {
                    setCoverUploading(true);
                    try {
                        const result = await uploadTemplateCover(croppedFile);
                        setCoverUrl(result.url);
                    } catch (err) {
                        toast.danger((err as Error).message);
                    } finally {
                        setCoverUploading(false);
                    }
                }}
                onCancel={() => setPendingCoverFile(null)}
            />

            <LeaveDraftDialog
                blocked={blocked}
                onStay={() => blocker.reset?.()}
                onLeave={() => blocker.proceed?.()}
            />
        </div>
    );
}

const EMPTY_KEYS: ReadonlySet<string> = new Set<string>();

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

/**
 * 编辑器设置弹层（字号与字体）。
 * @param props.fontSize - 当前字号。
 * @param props.fontFamily - 当前字体。
 * @param props.onFontSizeChange - 修改字号。
 * @param props.onFontFamilyChange - 修改字体。
 * @remarks 自持展开状态，点击遮罩关闭。
 */
function TemplateSettingsMenu({
    fontSize,
    fontFamily,
    onFontSizeChange,
    onFontFamilyChange,
}: {
    fontSize: number;
    fontFamily: string;
    onFontSizeChange: (value: number) => void;
    onFontFamilyChange: (value: string) => void;
}) {
    const [settingsOpen, setSettingsOpen] = useState(false);
    const fontSizes = Array.from(
        { length: EDITOR_FONT_SIZE_MAX - EDITOR_FONT_SIZE_MIN + 1 },
        (_, index) => EDITOR_FONT_SIZE_MIN + index,
    );

    return (
        <div className="relative shrink-0">
            <Button
                size="sm"
                variant="ghost"
                isIconOnly
                aria-label="编辑器设置"
                onPress={() => setSettingsOpen((open) => !open)}
            >
                <Settings2 className="size-3.5" />
            </Button>
            {settingsOpen && (
                <>
                    <button
                        type="button"
                        aria-label="关闭设置"
                        onClick={() => setSettingsOpen(false)}
                        className="fixed inset-0 z-40 cursor-default"
                    />
                    <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-xl border border-default-200 bg-background p-3 flex flex-col gap-3 shadow-sm">
                        <label className="flex flex-col gap-1 text-xs">
                            字号
                            <select
                                value={fontSize}
                                onChange={(event) =>
                                    onFontSizeChange(Number(event.target.value))
                                }
                                className="h-8 w-full px-2 rounded-lg border border-default-200 bg-background text-sm outline-none focus:border-default-400"
                            >
                                {fontSizes.map((size) => (
                                    <option key={size} value={size}>
                                        {size}px
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col gap-1 text-xs">
                            字体
                            <select
                                value={fontFamily}
                                onChange={(event) =>
                                    onFontFamilyChange(event.target.value)
                                }
                                className="h-8 w-full px-2 rounded-lg border border-default-200 bg-background text-sm outline-none focus:border-default-400"
                            >
                                {EDITOR_FONT_OPTIONS.map((font) => (
                                    <option
                                        key={font.value}
                                        value={font.value}
                                        style={{ fontFamily: font.value }}
                                    >
                                        {font.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                </>
            )}
        </div>
    );
}

/**
 * 提交审核弹窗：填写描述、分类、标签并上传封面。
 * @param props.open - 是否打开。
 * @param props.submitting - 是否正在提交。
 * @param props.description - 模板描述。
 * @param props.category - 模板分类。
 * @param props.tagsInput - 标签输入框内容。
 * @param props.coverUrl - 已上传封面地址。
 * @param props.coverUploading - 封面是否上传中。
 * @param props.onDescriptionChange - 描述变更回调。
 * @param props.onCategoryChange - 分类变更回调。
 * @param props.onTagsChange - 标签变更回调。
 * @param props.onPickCover - 选择待裁剪封面文件。
 * @param props.onCancel - 取消并关闭。
 * @param props.onConfirm - 确认提交。
 */
function PublishDialog({
    open,
    submitting,
    description,
    category,
    tagsInput,
    coverUrl,
    coverUploading,
    onDescriptionChange,
    onCategoryChange,
    onTagsChange,
    onPickCover,
    onCancel,
    onConfirm,
}: {
    open: boolean;
    submitting: boolean;
    description: string;
    category: string;
    tagsInput: string;
    coverUrl: string;
    coverUploading: boolean;
    onDescriptionChange: (value: string) => void;
    onCategoryChange: (value: string) => void;
    onTagsChange: (value: string) => void;
    onPickCover: (file: File) => void;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <AlertDialog
            isOpen={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen && !submitting) {
                    onCancel();
                }
            }}
        >
            <AlertDialog.Backdrop>
                <AlertDialog.Container>
                    <AlertDialog.Dialog className="sm:max-w-105">
                        <AlertDialog.CloseTrigger />
                        <AlertDialog.Header>
                            <AlertDialog.Icon status="accent" />
                            <AlertDialog.Heading>
                                提交模板审核
                            </AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body className="flex flex-col gap-4">
                            <CoverField
                                coverUrl={coverUrl}
                                uploading={coverUploading}
                                onPick={onPickCover}
                            />
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="template-description">
                                    模板描述
                                </Label>
                                <TextArea
                                    id="template-description"
                                    value={description}
                                    onChange={(event) =>
                                        onDescriptionChange(event.target.value)
                                    }
                                    placeholder="说明模板用途、技术栈与使用方式…"
                                    rows={3}
                                    maxLength={500}
                                    variant="secondary"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="template-category">分类</Label>
                                <Select
                                    id="template-category"
                                    value={category}
                                    onChange={(value) =>
                                        onCategoryChange(
                                            typeof value === "string"
                                                ? value
                                                : TEMPLATE_CATEGORIES[0].id,
                                        )
                                    }
                                    aria-label="模板分类"
                                    variant="secondary"
                                    className="w-full"
                                >
                                    <Select.Trigger>
                                        <Select.Value />
                                        <Select.Indicator />
                                    </Select.Trigger>
                                    <Select.Popover>
                                        <ListBox>
                                            {TEMPLATE_CATEGORIES.map((item) => (
                                                <ListBox.Item
                                                    key={item.id}
                                                    id={item.id}
                                                    textValue={item.label}
                                                >
                                                    {item.label}
                                                    <ListBox.ItemIndicator />
                                                </ListBox.Item>
                                            ))}
                                        </ListBox>
                                    </Select.Popover>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="template-tags">标签</Label>
                                <Input
                                    id="template-tags"
                                    value={tagsInput}
                                    onChange={(event) =>
                                        onTagsChange(event.target.value)
                                    }
                                    placeholder="标签，逗号分隔"
                                    maxLength={100}
                                    variant="secondary"
                                />
                                <p className="text-xs text-foreground/40">
                                    提交后进入人工审核，通过后上架模板市场
                                </p>
                            </div>
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button
                                slot="close"
                                variant="tertiary"
                                isDisabled={submitting || coverUploading}
                                onPress={onCancel}
                            >
                                取消
                            </Button>
                            <Button
                                slot="close"
                                variant="primary"
                                className="gap-1.5"
                                isDisabled={
                                    submitting || coverUploading || !coverUrl
                                }
                                onPress={onConfirm}
                            >
                                {submitting || coverUploading ? (
                                    <Spinner size="sm" color="current" />
                                ) : (
                                    <Send className="size-4" />
                                )}
                                提交审核
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </AlertDialog>
    );
}

const COVER_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

/**
 * 模板封面上传：选择图片后进入裁剪弹窗，上传成功返回封面地址。
 */
function CoverField({
    coverUrl,
    uploading,
    onPick,
}: {
    coverUrl: string;
    uploading: boolean;
    onPick: (file: File) => void;
}) {
    const inputRef = useRef<HTMLInputElement | null>(null);

    const handlePick = () => {
        inputRef.current?.click();
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) {
            return;
        }
        if (!file.type.startsWith("image/")) {
            toast.danger("请选择图片文件");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.danger("图片不能超过 5 MB");
            return;
        }
        onPick(file);
    };

    return (
        <div className="flex flex-col gap-2">
            <Label>
                模板封面 <span className="text-danger">*</span>
            </Label>
            <div className="flex items-center gap-4">
                <button
                    type="button"
                    onClick={handlePick}
                    disabled={uploading}
                    aria-label={coverUrl ? "点击更换封面" : "点击上传封面"}
                    className="group relative w-full h-22.5 rounded-xl border border-default-200/70 overflow-hidden bg-default-100/60 flex items-center justify-center shrink-0 cursor-pointer hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed transition-colors"
                >
                    {coverUrl ? (
                        <img
                            src={coverUrl}
                            alt="模板封面预览"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <span className="text-xs text-foreground/40">
                            暂无封面
                        </span>
                    )}
                    <span
                        className={`absolute inset-0 flex items-center justify-center gap-1 text-xs font-medium text-white bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100${uploading ? " opacity-100" : ""}`}
                    >
                        {uploading ? (
                            <Spinner size="sm" className="size-3.5" />
                        ) : (
                            <Camera className="size-3.5" />
                        )}
                        {coverUrl ? "更换封面" : "上传封面"}
                    </span>
                </button>
            </div>
            <input
                ref={inputRef}
                type="file"
                accept={COVER_ACCEPT}
                className="hidden"
                onChange={handleChange}
            />
        </div>
    );
}

/**
 * 未提交模板时离开页面的确认对话框。
 * @param props.blocked - 是否拦截了导航。
 * @param props.onStay - 留在当前页面。
 * @param props.onLeave - 放弃编辑并离开。
 */
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
                                模板尚未提交，离开后已编辑的文件会丢失。确定要离开吗？
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
