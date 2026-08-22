import { Button, Chip, toast, useOverlayState } from "@heroui/react";
import {
    createFileRoute,
    Link,
    useNavigate,
    useParams,
} from "@tanstack/react-router";
import {
    ArrowLeft,
    BookOpen,
    CalendarDays,
    FileText,
    Pencil,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ChapterEditor } from "~/components/novels/ChapterEditor";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { useAuth } from "~/hooks/useAuth";
import { useChapter, useChapters, useNovel } from "~/hooks/useNovels";
import { deleteNovel } from "~/lib/api/novels";

export const Route = createFileRoute("/novels/$id/")({
    component: ReaderPage,
});

/**
 * 小说阅读 / 展示页（只读）。作者在这里看到的是已发布内容，
 * 需要修改时点击「编辑」进入 /novels/$id/edit 独立编辑器。
 */
function ReaderPage() {
    const { id } = useParams({ from: "/novels/$id/" });
    const navigate = useNavigate();
    const { user } = useAuth();
    const { novel } = useNovel(id);
    const { chapters, isLoading: chaptersLoading } = useChapters(id);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const { chapter, isLoading: chapterLoading } = useChapter(id, selectedId);

    const isOwner = !!novel && novel.authorId === user?.id;

    // 章节加载完成后默认选中第一章。
    useEffect(() => {
        if (!selectedId && chapters.length > 0) {
            setSelectedId(chapters[0].id);
        }
    }, [chapters, selectedId]);

    // 删除小说确认
    const deleteNovelState = useOverlayState();
    const confirmDeleteNovel = async () => {
        await deleteNovel(id);
        toast.success("已删除小说");
        navigate({ to: "/novels" });
    };

    return (
        <div className="flex h-[100dvh] flex-col">
            {/* 顶部栏 */}
            <header className="flex items-center gap-3 border-b border-default-200/70 px-4 py-3">
                <Link
                    to="/novels"
                    className="rounded-xl p-2 text-foreground/60 transition-colors hover:bg-hover hover:text-foreground"
                    aria-label="返回小说列表"
                >
                    <ArrowLeft className="size-5" />
                </Link>
                <div className="min-w-0 flex-1">
                    {novel ? (
                        <div className="flex items-center gap-2">
                            <h1 className="truncate text-lg font-semibold">
                                {novel.title}
                            </h1>
                            {novel.published && (
                                <Chip
                                    size="sm"
                                    variant="soft"
                                    className="shrink-0 bg-success/15 text-success"
                                >
                                    已发布
                                </Chip>
                            )}
                            {!novel.published && (
                                <Chip
                                    size="sm"
                                    variant="soft"
                                    className="shrink-0 bg-background/80 text-foreground/70"
                                >
                                    草稿
                                </Chip>
                            )}
                        </div>
                    ) : (
                        <div className="h-6 w-40 animate-pulse rounded bg-default-100/60" />
                    )}
                    <p className="truncate text-xs text-foreground/50">
                        {novel?.authorName
                            ? `作者：${novel.authorName}`
                            : "加载中…"}
                        {" · "}
                        {chapters.length} 章
                    </p>
                </div>
                {isOwner && (
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="primary"
                            onPress={() =>
                                navigate({
                                    to: "/novels/$id/edit",
                                    params: { id },
                                })
                            }
                        >
                            <Pencil className="size-3.5" />
                            编辑
                        </Button>
                        <Button
                            size="sm"
                            variant="danger"
                            onPress={deleteNovelState.open}
                        >
                            删除小说
                        </Button>
                    </div>
                )}
            </header>

            <div className="flex min-h-0 flex-1">
                {/* 章节侧栏（只读） */}
                <aside className="flex w-64 shrink-0 flex-col border-r border-default-200/70">
                    <div className="px-4 py-3">
                        <span className="text-sm font-semibold">章节</span>
                    </div>
                    <div className="flex-1 space-y-1 overflow-auto px-2 pb-3">
                        {chaptersLoading ? (
                            Array.from({ length: 4 }, (_, i) => i).map(
                                (key) => (
                                    <div
                                        key={key}
                                        className="h-9 animate-pulse rounded-lg bg-default-100/60"
                                    />
                                ),
                            )
                        ) : chapters.length === 0 ? (
                            <p className="px-2 py-6 text-center text-xs text-foreground/40">
                                暂无章节
                            </p>
                        ) : (
                            chapters.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setSelectedId(c.id)}
                                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                                        c.id === selectedId
                                            ? "bg-primary/10 text-primary"
                                            : "hover:bg-hover"
                                    }`}
                                >
                                    <FileText className="size-4 shrink-0 opacity-60" />
                                    <span className="truncate">{c.title}</span>
                                </button>
                            ))
                        )}
                    </div>
                </aside>

                {/* 正文区 */}
                <main className="flex min-w-0 flex-1 flex-col bg-surface">
                    {!selectedId ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-foreground/40">
                            <FileText className="size-10" />
                            <p className="text-sm">
                                从左侧选择一个章节开始阅读
                            </p>
                        </div>
                    ) : chapterLoading || !chapter ? (
                        <div className="flex flex-1 items-center justify-center">
                            <BookOpen className="size-6 animate-spin text-foreground/40" />
                        </div>
                    ) : (
                        <div className="flex min-h-0 flex-1 flex-col">
                            {/* 展示信息：封面 + 标题 + 作者 + 简介 */}
                            <div className="flex gap-5 border-b border-default-200/70 px-6 py-5">
                                <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-xl ring-1 ring-inset ring-default-200/60">
                                    {novel?.coverUrl ? (
                                        <img
                                            src={novel.coverUrl}
                                            alt={novel.title}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-default-100/60">
                                            <BookOpen className="size-6 text-primary/40" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex min-w-0 flex-col gap-1.5">
                                    <h2 className="text-xl font-bold">
                                        {novel?.title}
                                    </h2>
                                    <p className="flex items-center gap-2 text-sm text-foreground/60">
                                        <span>
                                            {novel?.authorName ?? "匿名"}
                                        </span>
                                        <span className="text-foreground/25">
                                            ·
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <CalendarDays className="size-3.5" />
                                            {novel
                                                ? new Date(
                                                      novel.updatedAt,
                                                  ).toLocaleDateString()
                                                : "—"}
                                        </span>
                                        <span className="text-foreground/25">
                                            ·
                                        </span>
                                        <span>{chapters.length} 章</span>
                                    </p>
                                    {novel?.description && (
                                        <p className="line-clamp-3 text-sm leading-relaxed text-foreground/70">
                                            {novel.description}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="min-h-0 flex-1">
                                <ChapterEditor
                                    key={chapter.id}
                                    initialContent={chapter.content}
                                    onChange={() => {}}
                                    editable={false}
                                />
                            </div>
                        </div>
                    )}
                </main>
            </div>

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
