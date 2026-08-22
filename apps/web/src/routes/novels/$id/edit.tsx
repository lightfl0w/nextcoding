import {
    Button,
    Chip,
    Input,
    Label,
    Modal,
    Spinner,
    TextField,
    toast,
    useOverlayState,
} from "@heroui/react";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import {
    ArrowLeft,
    Camera,
    Check,
    FileText,
    Loader2,
    Pencil,
    Plus,
    Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { ImageCropModal } from "~/components/ImageCropModal";
import { ChapterEditor } from "~/components/novels/ChapterEditor";
import { useAuth } from "~/hooks/useAuth";
import { useChapter, useChapters, useNovel } from "~/hooks/useNovels";
import {
    createChapter,
    deleteChapter,
    deleteNovel,
    publishNovel,
    renameNovel,
    unpublishNovel,
    updateChapter,
    uploadNovelCover,
} from "~/lib/api/novels";

export const Route = createFileRoute("/novels/$id/edit")({
    component: NovelEditorPage,
});

type SaveState = "idle" | "saving" | "saved";

/**
 * 小说编辑器（仅作者可进入）。阅读/展示页是 /novels/$id；
 * 这里负责标题/简介/封面的行内保存与发布、章节的增删改。
 * 非作者访问时自动跳回阅读页。
 */
function NovelEditorPage() {
    const { id } = useParams({ from: "/novels/$id/edit" });
    const navigate = useNavigate();
    const { user } = useAuth();
    const { novel, mutate: mutateNovel } = useNovel(id);
    const { chapters, isLoading: chaptersLoading, mutate: mutateChapters } =
        useChapters(id);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const { chapter, isLoading: chapterLoading } = useChapter(id, selectedId);

    const isOwner = !!novel && novel.authorId === user?.id;

    // 非作者直接跳回阅读页。
    useEffect(() => {
        if (novel && !isOwner) {
            void navigate({ to: "/novels/$id", params: { id } });
        }
    }, [novel, isOwner, id, navigate]);

    const [saveState, setSaveState] = useState<SaveState>("idle");
    const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );

    // 章节加载完成后默认选中第一章。
    useEffect(() => {
        if (!selectedId && chapters.length > 0) {
            setSelectedId(chapters[0].id);
        }
    }, [chapters, selectedId]);

    const selectedChapter = chapters.find((c) => c.id === selectedId) ?? null;

    const handleContentChange = (html: string) => {
        if (!selectedId || !isOwner) {
            return;
        }
        setSaveState("saving");
        if (saveTimer.current) {
            clearTimeout(saveTimer.current);
        }
        saveTimer.current = setTimeout(async () => {
            try {
                await updateChapter(id, selectedId, {
                    title: selectedChapter?.title ?? "未命名章节",
                    content: html,
                });
                setSaveState("saved");
            } catch (error) {
                toast.danger((error as Error).message || "保存失败");
                setSaveState("idle");
            }
        }, 800);
    };

    // 新建章节弹窗
    const addState = useOverlayState();
    const [addTitle, setAddTitle] = useState("");
    const openAdd = () => {
        setAddTitle("");
        addState.open();
    };
    const confirmAdd = async () => {
        const title = addTitle.trim();
        if (!title) {
            toast.danger("请输入章节名称");
            return;
        }
        try {
            const { chapter: created } = await createChapter(id, title);
            await mutateChapters();
            setSelectedId(created.id);
            addState.close();
            toast.success("已新建章节");
        } catch (error) {
            toast.danger((error as Error).message || "新建章节失败");
        }
    };

    // 重命名章节弹窗
    const renameState = useOverlayState();
    const [renameTitle, setRenameTitle] = useState("");
    const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
    const openRename = (chapterId: string, current: string) => {
        setRenameTargetId(chapterId);
        setRenameTitle(current);
        renameState.open();
    };
    const confirmRename = async () => {
        const title = renameTitle.trim();
        if (!title || !renameTargetId) {
            toast.danger("请输入章节名称");
            return;
        }
        try {
            await updateChapter(id, renameTargetId, { title });
            await mutateChapters();
            renameState.close();
            toast.success("已重命名");
        } catch (error) {
            toast.danger((error as Error).message || "重命名失败");
        }
    };

    // 编辑/发布小说弹窗（含名称、简介、封面）
    const renameNovelState = useOverlayState();
    const [novelTitle, setNovelTitle] = useState("");
    const [novelDesc, setNovelDesc] = useState("");
    const [novelCover, setNovelCover] = useState("");
    const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
    const [coverUploading, setCoverUploading] = useState(false);
    const coverInputRef = useRef<HTMLInputElement | null>(null);

    // 进入页面时按当前小说初始化一次，之后由行内编辑驱动。
    const initializedRef = useRef<string | null>(null);
    useEffect(() => {
        if (novel && initializedRef.current !== novel.id) {
            initializedRef.current = novel.id;
            setNovelTitle(novel.title);
            setNovelDesc(novel.description ?? "");
            setNovelCover(novel.coverUrl ?? "");
        }
    }, [novel]);

    const titleDirty = !!novel && novelTitle.trim() !== (novel.title ?? "");

    const openRenameNovel = () => {
        renameNovelState.open();
    };
    const confirmRenameNovel = async () => {
        const title = novelTitle.trim();
        if (!title) {
            toast.danger("请输入小说名称");
            return;
        }
        try {
            await renameNovel(id, title, novelDesc, novelCover.trim() || null);
            await mutateNovel();
            renameNovelState.close();
            toast.success("已保存");
        } catch (error) {
            toast.danger((error as Error).message || "保存失败");
        }
    };
    // 行内快速保存：保存标题（同时保留已改的简介/封面）。
    const [saveInfoPending, setSaveInfoPending] = useState(false);
    const confirmSave = async () => {
        const title = novelTitle.trim();
        if (!title) {
            toast.danger("请输入小说名称");
            return;
        }
        setSaveInfoPending(true);
        try {
            await renameNovel(id, title, novelDesc, novelCover.trim() || null);
            await mutateNovel();
            toast.success("已保存");
        } catch (error) {
            toast.danger((error as Error).message || "保存失败");
        } finally {
            setSaveInfoPending(false);
        }
    };
    // 发布：更新信息并置为已发布
    const confirmPublish = async () => {
        const title = novelTitle.trim();
        if (!title) {
            toast.danger("请输入小说名称");
            return;
        }
        if (!novelCover.trim()) {
            toast.danger("请先上传小说封面");
            return;
        }
        try {
            await publishNovel(id, {
                title,
                description: novelDesc,
                coverUrl: novelCover.trim() || null,
            });
            await mutateNovel();
            renameNovelState.close();
            toast.success("已发布，所有人可见");
        } catch (error) {
            toast.danger((error as Error).message || "发布失败");
        }
    };
    // 取消发布：退回草稿
    const handleUnpublish = async () => {
        try {
            await unpublishNovel(id);
            await mutateNovel();
            toast.success("已转为草稿");
        } catch (error) {
            toast.danger((error as Error).message || "操作失败");
        }
    };
    // 选图后进入裁剪，裁剪完成即上传封面
    const handleCoverPick = (event: React.ChangeEvent<HTMLInputElement>) => {
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
        setPendingCoverFile(file);
    };
    const handleCoverCropped = async (croppedFile: File) => {
        setCoverUploading(true);
        try {
            const result = await uploadNovelCover(croppedFile);
            setNovelCover(result.url);
        } catch (error) {
            toast.danger((error as Error).message || "封面上传失败");
        } finally {
            setCoverUploading(false);
        }
    };

    // 删除章节确认
    const deleteChapterState = useOverlayState();
    const [deleteChapterId, setDeleteChapterId] = useState<string | null>(
        null,
    );
    const askDeleteChapter = (chapterId: string) => {
        setDeleteChapterId(chapterId);
        deleteChapterState.open();
    };
    const confirmDeleteChapter = async () => {
        if (!deleteChapterId) {
            return;
        }
        const removed = deleteChapterId;
        await deleteChapter(id, removed);
        await mutateChapters();
        if (selectedId === removed) {
            setSelectedId(null);
        }
        toast.success("已删除章节");
    };

    // 删除小说确认
    const deleteNovelState = useOverlayState();
    const confirmDeleteNovel = async () => {
        await deleteNovel(id);
        toast.success("已删除小说");
        navigate({ to: "/novels" });
    };

    // 尚未加载或跳转中：只渲染骨架，避免非作者看到编辑器内容。
    if (!novel) {
        return (
            <div className="flex h-[100dvh] items-center justify-center">
                {novel === undefined ? (
                    <Loader2 className="size-6 animate-spin text-foreground/40" />
                ) : (
                    <p className="text-sm text-foreground/50">无权限访问</p>
                )}
            </div>
        );
    }

    return (
        <div className="flex h-[100dvh] flex-col">
            {/* 顶部栏 */}
            <header className="flex items-center gap-3 border-b border-default-200/70 px-4 py-3">
                <Link
                    to="/novels/$id"
                    params={{ id }}
                    className="rounded-xl p-2 text-foreground/60 transition-colors hover:bg-hover hover:text-foreground"
                    aria-label="返回阅读页"
                >
                    <ArrowLeft className="size-5" />
                </Link>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <Input
                            value={novelTitle}
                            onChange={(event) =>
                                setNovelTitle(event.target.value)
                            }
                            placeholder="小说标题"
                            className="flex-1 min-w-0 [&_input]:text-lg [&_input]:font-semibold"
                        />
                        {!novel.published && (
                            <Chip
                                size="sm"
                                variant="soft"
                                className="shrink-0 bg-background/80 text-foreground/70"
                            >
                                草稿
                            </Chip>
                        )}
                        {novel.published && (
                            <Chip
                                size="sm"
                                variant="soft"
                                className="shrink-0 bg-success/15 text-success"
                            >
                                已发布
                            </Chip>
                        )}
                    </div>
                    <p className="truncate text-xs text-foreground/50">
                        {novel?.authorName ? `作者：${novel.authorName}` : "加载中…"}
                        {" · "}
                        {chapters.length} 章
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {saveState === "saving" && (
                        <span className="flex items-center gap-1 text-xs text-foreground/50">
                            <Loader2 className="size-3.5 animate-spin" />
                            保存中
                        </span>
                    )}
                    {saveState === "saved" && (
                        <span className="flex items-center gap-1 text-xs text-success">
                            <Check className="size-3.5" />
                            已保存
                        </span>
                    )}
                    <Button
                        size="sm"
                        variant="tertiary"
                        onPress={confirmSave}
                        isDisabled={!titleDirty || saveInfoPending}
                    >
                        {saveInfoPending ? <Spinner size="sm" /> : "保存"}
                    </Button>
                    {!novel?.published && (
                        <Button
                            size="sm"
                            variant="primary"
                            onPress={openRenameNovel}
                        >
                            发布
                        </Button>
                    )}
                    {novel?.published && (
                        <Button
                            size="sm"
                            variant="ghost"
                            onPress={handleUnpublish}
                        >
                            转为草稿
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="danger"
                        onPress={deleteNovelState.open}
                    >
                        删除小说
                    </Button>
                </div>
            </header>

            <div className="flex min-h-0 flex-1">
                {/* 章节侧栏 */}
                <aside className="flex w-64 shrink-0 flex-col border-r border-default-200/70">
                    <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm font-semibold">章节</span>
                        <Button
                            size="sm"
                            variant="ghost"
                            onPress={openAdd}
                            aria-label="新增章节"
                        >
                            <Plus className="size-4" />
                            新增
                        </Button>
                    </div>
                    <div className="flex-1 space-y-1 overflow-auto px-2 pb-3">
                        {chaptersLoading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="h-9 animate-pulse rounded-lg bg-default-100/60"
                                />
                            ))
                        ) : chapters.length === 0 ? (
                            <p className="px-2 py-6 text-center text-xs text-foreground/40">
                                点击「新增」创建第一章
                            </p>
                        ) : (
                            chapters.map((c) => (
                                <div
                                    key={c.id}
                                    className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-sm transition-colors ${
                                        c.id === selectedId
                                            ? "bg-primary/10 text-primary"
                                            : "hover:bg-hover"
                                    }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setSelectedId(c.id)}
                                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                    >
                                        <FileText className="size-4 shrink-0 opacity-60" />
                                        <span className="truncate">
                                            {c.title}
                                        </span>
                                    </button>
                                    <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                openRename(c.id, c.title)
                                            }
                                            aria-label="重命名章节"
                                            className="rounded p-1 text-foreground/50 hover:text-foreground"
                                        >
                                            <Pencil className="size-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                askDeleteChapter(c.id)
                                            }
                                            aria-label="删除章节"
                                            className="rounded p-1 text-foreground/50 hover:text-danger"
                                        >
                                            <Trash2 className="size-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </aside>

                {/* 正文区 */}
                <main className="flex min-w-0 flex-1 flex-col bg-surface">
                    {!selectedId ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-foreground/40">
                            <FileText className="size-10" />
                            <p className="text-sm">从左侧选择一个章节开始阅读</p>
                        </div>
                    ) : chapterLoading || !chapter ? (
                        <div className="flex flex-1 items-center justify-center">
                            <Loader2 className="size-6 animate-spin text-foreground/40" />
                        </div>
                    ) : (
                        <ChapterEditor
                            key={chapter.id}
                            initialContent={chapter.content}
                            onChange={handleContentChange}
                            editable={isOwner}
                        />
                    )}
                </main>
            </div>

            {/* 新建章节弹窗 */}
            <Modal state={addState}>
                <Modal.Backdrop>
                    <Modal.Container>
                        <Modal.Dialog className="sm:max-w-[420px]">
                            <Modal.CloseTrigger />
                            <Modal.Header>
                                <Modal.Heading>新增章节</Modal.Heading>
                            </Modal.Header>
                            <Modal.Body className="flex flex-col gap-4">
                                <TextField
                                    className="flex flex-col gap-1.5"
                                    value={addTitle}
                                    onChange={setAddTitle}
                                >
                                    <Label className="text-xs text-foreground/60">
                                        章节名称
                                    </Label>
                                    <Input
                                        placeholder="例如：第一章 启程"
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                void confirmAdd();
                                            }
                                        }}
                                    />
                                </TextField>
                            </Modal.Body>
                            <Modal.Footer>
                                <Button
                                    slot="close"
                                    variant="tertiary"
                                    isDisabled={addState.isOpen === false}
                                >
                                    取消
                                </Button>
                                <Button variant="primary" onPress={confirmAdd}>
                                    创建
                                </Button>
                            </Modal.Footer>
                        </Modal.Dialog>
                    </Modal.Container>
                </Modal.Backdrop>
            </Modal>

            {/* 重命名章节弹窗 */}
            <Modal state={renameState}>
                <Modal.Backdrop>
                    <Modal.Container>
                        <Modal.Dialog className="sm:max-w-[420px]">
                            <Modal.CloseTrigger />
                            <Modal.Header>
                                <Modal.Heading>重命名章节</Modal.Heading>
                            </Modal.Header>
                            <Modal.Body className="flex flex-col gap-4">
                                <TextField
                                    className="flex flex-col gap-1.5"
                                    value={renameTitle}
                                    onChange={setRenameTitle}
                                >
                                    <Label className="text-xs text-foreground/60">
                                        章节名称
                                    </Label>
                                    <Input
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                void confirmRename();
                                            }
                                        }}
                                    />
                                </TextField>
                            </Modal.Body>
                            <Modal.Footer>
                                <Button slot="close" variant="tertiary">
                                    取消
                                </Button>
                                <Button
                                    variant="primary"
                                    onPress={confirmRename}
                                >
                                    保存
                                </Button>
                            </Modal.Footer>
                        </Modal.Dialog>
                    </Modal.Container>
                </Modal.Backdrop>
            </Modal>

            {/* 编辑 / 发布小说弹窗 */}
            <Modal state={renameNovelState}>
                <Modal.Backdrop>
                    <Modal.Container>
                        <Modal.Dialog className="sm:max-w-[440px]">
                            <Modal.CloseTrigger />
                            <Modal.Header>
                                <Modal.Heading>发布小说</Modal.Heading>
                            </Modal.Header>
                            <Modal.Body className="flex flex-col gap-4">
                                <TextField
                                    className="flex flex-col gap-1.5"
                                    value={novelTitle}
                                    onChange={setNovelTitle}
                                >
                                    <Label className="text-xs text-foreground/60">
                                        小说名称
                                    </Label>
                                    <Input
                                        placeholder="例如：星海征途"
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                void confirmPublish();
                                            }
                                        }}
                                    />
                                </TextField>
                                <TextField
                                    className="flex flex-col gap-1.5"
                                    value={novelDesc}
                                    onChange={setNovelDesc}
                                >
                                    <Label className="text-xs text-foreground/60">
                                        简介（可选）
                                    </Label>
                                    <Input placeholder="一句话介绍你的故事" />
                                </TextField>
                                <div className="flex flex-col gap-2">
                                    <Label className="text-xs text-foreground/60">
                                        封面 <span className="text-danger">*</span>（必选）
                                    </Label>
                                    <button
                                        type="button"
                                        onClick={() => coverInputRef.current?.click()}
                                        disabled={coverUploading}
                                        aria-label={
                                            novelCover ? "点击更换封面" : "点击上传封面"
                                        }
                                        className="group relative h-40 w-full overflow-hidden rounded-xl border border-default-200/70 bg-default-100/60 transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed"
                                    >
                                        {novelCover ? (
                                            <img
                                                src={novelCover}
                                                alt="封面预览"
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <span className="flex h-full w-full items-center justify-center text-xs text-foreground/40">
                                                点击上传封面
                                            </span>
                                        )}
                                        <span
                                            className={`absolute inset-0 flex items-center justify-center gap-1 text-xs font-medium text-white bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100${coverUploading ? " opacity-100" : ""}`}
                                        >
                                            {coverUploading ? (
                                                <Spinner
                                                    size="sm"
                                                    className="!size-3.5"
                                                />
                                            ) : (
                                                <Camera className="size-3.5" />
                                            )}
                                            {novelCover ? "更换封面" : "上传封面"}
                                        </span>
                                    </button>
                                    <input
                                        ref={coverInputRef}
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp,image/gif"
                                        className="hidden"
                                        onChange={handleCoverPick}
                                    />
                                </div>
                            </Modal.Body>
                            <Modal.Footer>
                                <Button slot="close" variant="tertiary">
                                    取消
                                </Button>
                                <Button
                                    variant="tertiary"
                                    onPress={confirmRenameNovel}
                                >
                                    保存草稿
                                </Button>
                                <Button variant="primary" onPress={confirmPublish}>
                                    发布
                                </Button>
                            </Modal.Footer>
                        </Modal.Dialog>
                    </Modal.Container>
                </Modal.Backdrop>
            </Modal>

            <ImageCropModal
                file={pendingCoverFile}
                title="裁剪小说封面"
                aspect={16 / 9}
                cropShape="rect"
                outputWidth={1280}
                outputHeight={720}
                fileName="cover.png"
                onCrop={handleCoverCropped}
                onCancel={() => setPendingCoverFile(null)}
            />

            {/* 删除章节确认 */}
            <ConfirmDialog
                state={deleteChapterState}
                heading="删除章节"
                description="确定删除这一章吗？章节内容将一并删除，此操作不可恢复。"
                confirmLabel="删除章节"
                onConfirm={confirmDeleteChapter}
            />

            {/* 删除小说确认 */}
            <ConfirmDialog
                state={deleteNovelState}
                heading="删除小说"
                description="确定删除整部小说吗？包含的全部章节都会删除，此操作不可恢复。"
                confirmLabel="删除小说"
                onConfirm={confirmDeleteNovel}
            />
        </div>
    );
}
