import { Avatar, Button, Card, Chip, Skeleton, toast } from "@heroui/react";
import {
    createFileRoute,
    Link,
    useLocation,
    useNavigate,
    useParams,
} from "@tanstack/react-router";
import {
    Eye,
    MessageCircle,
    MessageSquare,
    Pencil,
    Star,
    Undo2,
} from "lucide-react";
import type * as Monaco from "monaco-editor";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "~/hooks/useAuth";
import { type Comment, useComments } from "~/hooks/useComments";
import { useWork, type WorkFile } from "~/hooks/useWork";
import { languageFromName, loadMonaco } from "~/lib/editor";
import { formatCount, formatDate } from "~/lib/format";

export const Route = createFileRoute("/work/$id/")({
    component: WorkDetailPage,
});

interface VersionMeta {
    version: number;
    message: string | null;
    createdAt: string;
}

async function fetcher<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`请求失败: ${res.status}`);
    return res.json();
}

function WorkDetailPage() {
    const { id } = useParams({ from: "/work/$id/" });
    const navigate = useNavigate();
    const { user } = useAuth();
    const { data: work, isLoading, error } = useWork(id);

    const { resolvedTheme } = useTheme();
    const theme: "light" | "dark" = resolvedTheme === "dark" ? "dark" : "light";

    const [monaco, setMonaco] = useState<typeof Monaco | null>(null);
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const [content, setContent] = useState<string | null>(null);
    const [contentError, setContentError] = useState(false);
    const [versions, setVersions] = useState<VersionMeta[]>([]);

    useEffect(() => {
        let mounted = true;
        loadMonaco().then((m) => mounted && setMonaco(m));
        return () => {
            mounted = false;
        };
    }, []);

    const selectFile = useCallback(
        async (file: WorkFile) => {
            setActiveKey(file.key);
            setContent(null);
            setContentError(false);
            try {
                const res = await fetch(
                    `/api/works/${id}/files/content?key=${encodeURIComponent(file.key)}`,
                );
                if (!res.ok) throw new Error(`请求失败: ${res.status}`);
                setContent(await res.text());
            } catch {
                setContentError(true);
            }
        },
        [id],
    );

    useEffect(() => {
        if (work?.files?.length && !activeKey) {
            selectFile(work.files[0]);
        }
    }, [work, activeKey, selectFile]);

    useEffect(() => {
        fetcher<VersionMeta[]>(`/api/works/${id}/versions`)
            .then(setVersions)
            .catch(() => {});
    }, [id]);

    if (isLoading) {
        return (
            <div className="p-6 w-full flex flex-col gap-5">
                <Skeleton className="h-8 w-64 rounded-lg" />
                <div className="flex flex-col lg:flex-row gap-4">
                    <Skeleton className="h-48 w-full lg:w-80 rounded-2xl" />
                    <Skeleton className="h-96 flex-1 rounded-2xl" />
                </div>
            </div>
        );
    }

    if (error || !work) {
        return (
            <div className="p-6 w-full flex flex-col items-center gap-3 py-24">
                <p className="text-base font-medium">作品不存在或已被删除</p>
                <Link to="/discover">
                    <Button variant="ghost" size="sm">
                        返回发现页
                    </Button>
                </Link>
            </div>
        );
    }

    const isOwner = !!user && user.id === work.userId;
    const activeFile = work.files.find((f) => f.key === activeKey);

    return (
        <div className="p-6 w-full flex flex-col gap-5">
            <header className="sticky top-0 z-20 -mx-6 px-6 py-3 sticky-glass flex items-center gap-3 min-w-0">
                <Link
                    to="/discover"
                    title="返回发现页"
                    className="p-1.5 rounded-lg hover:bg-default-100 text-foreground/60 shrink-0"
                >
                    <Undo2 className="size-4" />
                </Link>
                <h1 className="text-xl font-bold tracking-tight truncate">
                    {work.title}
                </h1>
                <div className="flex-1" />
                <div className="flex items-center gap-3 text-sm text-foreground/60 shrink-0">
                    <span
                        className="flex items-center gap-1"
                        title={`${work.views} 次浏览`}
                    >
                        <Eye className="size-4" />
                        {formatCount(work.views)}
                    </span>
                    <span
                        className="flex items-center gap-1"
                        title={`${work.likes} 次点赞`}
                    >
                        <Star className="size-4" />
                        {formatCount(work.likes)}
                    </span>
                </div>
                {isOwner && (
                    <Button
                        size="sm"
                        className="gap-1.5 shrink-0"
                        onPress={() =>
                            navigate({ to: "/work/$id/edit", params: { id } })
                        }
                    >
                        <Pencil className="size-3.5" />
                        编辑
                    </Button>
                )}
            </header>

            <div className="flex flex-col lg:flex-row gap-4 items-start">
                <aside className="w-full lg:w-80 flex flex-col gap-4 shrink-0">
                    <Card className="w-full p-0 shadow-none rounded-2xl">
                        <div className="p-4 flex flex-col gap-3">
                            <div className="flex items-center gap-2.5">
                                <Avatar size="sm">
                                    <Avatar.Fallback>
                                        {(work.author.name ?? "?")
                                            .charAt(0)
                                            .toUpperCase()}
                                    </Avatar.Fallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    <span className="text-sm">
                                        {work.author.name ?? "匿名"}
                                    </span>
                                    <span className="text-xs text-foreground/50">
                                        {formatDate(work.createdAt)} 发布
                                    </span>
                                </div>
                            </div>
                            {work.description && (
                                <p className="text-sm leading-relaxed text-foreground/70 whitespace-pre-wrap">
                                    {work.description}
                                </p>
                            )}
                            {Array.isArray(work.tags) &&
                                work.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {work.tags.map((tag) => (
                                            <Chip
                                                key={tag}
                                                size="sm"
                                                variant="soft"
                                            >
                                                <Chip.Label>{tag}</Chip.Label>
                                            </Chip>
                                        ))}
                                    </div>
                                )}
                        </div>
                    </Card>

                    <Card className="w-full p-0 shadow-none rounded-2xl">
                        <div className="p-4 flex flex-col gap-2">
                            <Card.Title className="text-sm">
                                版本历史
                            </Card.Title>
                            {versions.length === 0 && (
                                <p className="text-xs text-foreground/40">
                                    暂无版本记录
                                </p>
                            )}
                            {versions.map((v) => (
                                <div
                                    key={v.version}
                                    className="flex flex-col gap-0.5 py-1 border-b border-default-100 last:border-b-0"
                                >
                                    <span className="text-xs font-medium">
                                        v{v.version}
                                    </span>
                                    <span className="text-xs text-foreground/60 truncate">
                                        {v.message ?? "无说明"}
                                    </span>
                                    <span className="text-xs text-foreground/40">
                                        {formatDate(v.createdAt)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </aside>

                <div className="flex-1 min-w-0 w-full">
                    <Card className="w-full p-0 shadow-none rounded-2xl overflow-hidden">
                        <div className="flex items-center gap-1 border-b border-default-200 px-2 h-10 overflow-x-auto">
                            {work.files.length === 0 && (
                                <span className="text-xs text-foreground/40 px-3">
                                    暂无文件
                                </span>
                            )}
                            {work.files.map((f) => (
                                <button
                                    key={f.key}
                                    type="button"
                                    onClick={() => selectFile(f)}
                                    className={`px-3 h-full text-xs whitespace-nowrap border-b-2 transition-colors ${
                                        activeKey === f.key
                                            ? "border-primary text-foreground"
                                            : "border-transparent text-foreground/60 hover:text-foreground"
                                    }`}
                                >
                                    {f.name}
                                </button>
                            ))}
                        </div>
                        <div className="h-[480px]">
                            {activeFile && content !== null && (
                                <CodeViewer
                                    monaco={monaco}
                                    theme={theme}
                                    content={content}
                                    filename={activeFile.name}
                                />
                            )}
                            {activeFile &&
                                content === null &&
                                !contentError && (
                                    <Skeleton className="h-full w-full rounded-none" />
                                )}
                            {contentError && (
                                <div className="h-full w-full flex items-center justify-center text-sm text-foreground/50">
                                    文件加载失败
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>

            <CommentsSection workId={id} />
        </div>
    );
}

function CommentsSection({ workId }: { workId: string }) {
    const { isLoggedIn } = useAuth();
    const location = useLocation();
    const { data: comments, isLoading, mutate } = useComments(workId);
    const [draft, setDraft] = useState("");
    const [posting, setPosting] = useState(false);
    const [replyingTo, setReplyingTo] = useState<{
        rootId: string;
        name: string;
    } | null>(null);

    const submit = async () => {
        const content = draft.trim();
        if (!content || posting) return;
        setPosting(true);
        try {
            const res = await fetch(`/api/works/${workId}/comments`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    content,
                    parentId: replyingTo?.rootId ?? null,
                }),
            });
            if (!res.ok) throw new Error(`请求失败: ${res.status}`);
            setDraft("");
            setReplyingTo(null);
            await mutate();
        } catch (err) {
            toast.danger((err as Error).message);
        } finally {
            setPosting(false);
        }
    };

    const roots = (comments ?? []).filter((c) => !c.parentId);
    const repliesByRoot = new Map<string, Comment[]>();
    for (const c of comments ?? []) {
        if (!c.parentId) continue;
        const list = repliesByRoot.get(c.parentId) ?? [];
        list.push(c);
        repliesByRoot.set(c.parentId, list);
    }

    return (
        <Card className="w-full p-0 shadow-none rounded-2xl">
            <div className="p-5 flex flex-col gap-5">
                <Card.Title className="text-sm flex items-center gap-2">
                    <MessageSquare className="size-4 text-foreground/50" />
                    评论
                    <span className="text-foreground/40 font-normal">
                        {comments?.length ?? 0}
                    </span>
                </Card.Title>

                {isLoggedIn ? (
                    <div className="rounded-2xl border border-default-200 bg-default-50/60 transition-colors focus-within:border-primary focus-within:bg-background">
                        {replyingTo && (
                            <div className="flex items-center gap-2 px-3.5 pt-2.5">
                                <span className="text-xs text-primary bg-primary-100 rounded-full px-2 py-0.5">
                                    回复 @{replyingTo.name}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setReplyingTo(null)}
                                    className="text-xs text-foreground/40 hover:text-foreground"
                                >
                                    取消
                                </button>
                            </div>
                        )}
                        <textarea
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder={
                                replyingTo
                                    ? `回复 @${replyingTo.name}…`
                                    : "写下你的看法…"
                            }
                            rows={3}
                            maxLength={500}
                            className="w-full resize-none bg-transparent px-3.5 pt-3 text-sm outline-none placeholder:text-foreground/35"
                        />
                        <div className="flex items-center justify-between px-3.5 pb-2.5">
                            <span className="text-xs text-foreground/35">
                                {draft.length}/500
                            </span>
                            <Button
                                size="sm"
                                onPress={submit}
                                isDisabled={!draft.trim() || posting}
                            >
                                {posting
                                    ? "发表中…"
                                    : replyingTo
                                      ? "发表回复"
                                      : "发表评论"}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-dashed border-default-200 px-4 py-3 text-sm text-foreground/60">
                        <Link
                            to="/auth"
                            search={{
                                mode: "login",
                                redirect: location.pathname,
                            }}
                            className="text-primary font-medium"
                        >
                            登录
                        </Link>{" "}
                        后即可参与评论
                    </div>
                )}

                {isLoading && <Skeleton className="h-24 w-full rounded-2xl" />}

                {comments?.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center gap-2 py-8 text-foreground/40">
                        <MessageCircle className="size-8" strokeWidth={1.5} />
                        <p className="text-sm">还没有评论，来抢沙发</p>
                    </div>
                )}

                <div className="flex flex-col divide-y divide-default-100">
                    {roots.map((root) => {
                        const replies = repliesByRoot.get(root.id) ?? [];
                        return (
                            <div key={root.id} className="flex flex-col">
                                <CommentRow
                                    comment={root}
                                    isLoggedIn={isLoggedIn}
                                    onReply={(name) =>
                                        setReplyingTo({
                                            rootId: root.id,
                                            name,
                                        })
                                    }
                                />
                                {replies.length > 0 && (
                                    <div className="flex flex-col ml-12 pl-4 mb-3 border-l-2 border-default-100">
                                        {replies.map((reply) => (
                                            <CommentRow
                                                key={reply.id}
                                                comment={reply}
                                                isReply
                                                isLoggedIn={isLoggedIn}
                                                onReply={(name) =>
                                                    setReplyingTo({
                                                        rootId: root.id,
                                                        name,
                                                    })
                                                }
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </Card>
    );
}

function CommentRow({
    comment,
    isReply = false,
    isLoggedIn,
    onReply,
}: {
    comment: Comment;
    isReply?: boolean;
    isLoggedIn: boolean;
    onReply?: (name: string) => void;
}) {
    return (
        <div className="py-3.5 flex gap-3">
            <Avatar size="sm" className="shrink-0">
                <Avatar.Fallback>
                    {(comment.author.name ?? "?").charAt(0).toUpperCase()}
                </Avatar.Fallback>
            </Avatar>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium">
                        {comment.author.name ?? "匿名"}
                    </span>
                    {isReply && (
                        <span className="text-xs text-foreground/35">回复</span>
                    )}
                    <span className="text-xs text-foreground/35">
                        {formatDate(comment.createdAt)}
                    </span>
                </div>
                <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap break-words">
                    {comment.content}
                </p>
                {isLoggedIn && onReply && (
                    <button
                        type="button"
                        onClick={() => onReply(comment.author.name ?? "匿名")}
                        className="flex items-center gap-1 text-xs text-foreground/45 hover:text-primary w-fit transition-colors"
                    >
                        <MessageCircle className="size-3.5" />
                        回复
                    </button>
                )}
            </div>
        </div>
    );
}

function CodeViewer({
    monaco,
    theme,
    content,
    filename,
}: {
    monaco: typeof Monaco | null;
    theme: "light" | "dark";
    content: string;
    filename: string;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!monaco || !ref.current) return;
        const language = languageFromName(filename);
        const uri = monaco.Uri.parse(
            `file:///works/${encodeURIComponent(filename)}`,
        );
        const model = monaco.editor.createModel(content, language, uri);
        const editor = monaco.editor.create(ref.current, {
            model,
            theme: theme === "dark" ? "vs-dark" : "vs",
            readOnly: true,
            automaticLayout: true,
            fontSize: 13,
            lineHeight: 20,
            tabSize: 2,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 12, bottom: 12 },
            glyphMargin: false,
            folding: true,
        });
        return () => {
            editor.dispose();
            model.dispose();
        };
    }, [monaco, content, filename, theme]);

    return <div ref={ref} className="h-full w-full" />;
}
