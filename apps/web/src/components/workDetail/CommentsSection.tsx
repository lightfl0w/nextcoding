import { Card, Skeleton, Tabs, useOverlayState } from "@heroui/react";
import { Clock, Flame, MessageCircle } from "lucide-react";
import { memo, useCallback, useState } from "react";
import type { KeyedMutator } from "swr";
import { useAuth } from "~/hooks/useAuth";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import {
    type SubmitComment,
    useCommentComposer,
} from "~/hooks/useCommentComposer";
import {
    type CommentNode,
    type CommentThread,
    useCommentThreads,
} from "~/hooks/useCommentThreads";
import type { Comment, CommentSort } from "~/lib/api";
import { CommentComposer, SignInPrompt } from "./CommentComposer";
import { CommentRow } from "./CommentRow";

interface CommentsSectionProps {
    comments: Comment[] | undefined;
    isLoading: boolean;
    mutate: KeyedMutator<Comment[]>;
    submitComment: SubmitComment;
    focusCommentId?: string | null;
    sort: CommentSort;
    onSortChange: (sort: CommentSort) => void;
    isOwner: boolean;
    currentUserId?: string | null;
    onDeleteComment: (commentId: string) => Promise<unknown>;
    onPinComment: (commentId: string, pinned: boolean) => Promise<unknown>;
    onLikeComment: (commentId: string) => Promise<unknown>;
}

function renderThreads(
    threads: CommentThread[],
    context: {
        isLoggedIn: boolean;
        currentUserId?: string | null;
        isOwner: boolean;
        submitComment: SubmitComment;
        focusCommentId?: string | null;
        mutate: () => Promise<unknown>;
        handleDelete: (commentId: string) => void;
        handlePin: (commentId: string, pinned: boolean) => void;
        handleLike: (commentId: string) => void;
    },
) {
    return (
        <div className="flex flex-col gap-1">
            {threads.map((thread) => (
                <CommentBranch
                    key={thread.root.id}
                    comment={thread.root}
                    replies={thread.children}
                    depth={0}
                    canReply={context.isLoggedIn}
                    currentUserId={context.currentUserId}
                    canModerate={context.isOwner}
                    submitComment={context.submitComment}
                    focusCommentId={context.focusCommentId}
                    onReload={context.mutate}
                    onDelete={context.handleDelete}
                    onPin={context.handlePin}
                    onLike={context.handleLike}
                />
            ))}
        </div>
    );
}

export const CommentsSection = memo(function CommentsSection({
    comments,
    isLoading,
    mutate,
    submitComment,
    focusCommentId,
    sort,
    onSortChange,
    isOwner,
    currentUserId,
    onDeleteComment,
    onPinComment,
    onLikeComment,
}: CommentsSectionProps) {
    const { isLoggedIn } = useAuth();
    const composer = useCommentComposer(submitComment, mutate);
    const threads = useCommentThreads(comments);

    const deleteState = useOverlayState();
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    const handleDelete = useCallback(
        (commentId: string) => {
            setDeleteTargetId(commentId);
            deleteState.open();
        },
        [deleteState],
    );

    const confirmDelete = useCallback(async () => {
        if (!deleteTargetId) {
            return;
        }
        await onDeleteComment(deleteTargetId);
        await mutate();
    }, [deleteTargetId, onDeleteComment, mutate]);
    const handlePin = useCallback(
        async (commentId: string, pinned: boolean) => {
            await onPinComment(commentId, pinned);
            await mutate();
        },
        [onPinComment, mutate],
    );
    const handleLike = useCallback(
        async (commentId: string) => {
            await onLikeComment(commentId);
            await mutate();
        },
        [onLikeComment, mutate],
    );

    const threadContext = {
        isLoggedIn,
        currentUserId,
        isOwner,
        submitComment,
        focusCommentId,
        mutate,
        handleDelete,
        handlePin,
        handleLike,
    };

    return (
        <>
            <Card>
                <Tabs
                    selectedKey={sort}
                    onSelectionChange={(key) => onSortChange(key as CommentSort)}
                    className="w-full"
                    aria-label="评论排序"
                >
                    <Card.Header className="flex flex-row w-full items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <Card.Title>评论</Card.Title>
                            {comments && comments.length > 0 && (
                                <span className="rounded-full bg-default-100 px-2 py-0.5 text-xs font-medium text-foreground/55">
                                    {comments.length}
                                </span>
                            )}
                        </div>

                        <Tabs.ListContainer>
                            <Tabs.List className="w-full">
                                <Tabs.Tab id="time" className="flex gap-1">
                                    <Clock className="size-3.5" />
                                    按时间
                                    <Tabs.Indicator />
                                </Tabs.Tab>
                                <Tabs.Tab
                                    id="popular"
                                    className="flex gap-1 whitespace-nowrap"
                                >
                                    <Flame className="size-3.5" />
                                    受欢迎度
                                    <Tabs.Indicator />
                                </Tabs.Tab>
                            </Tabs.List>
                        </Tabs.ListContainer>
                    </Card.Header>

                    <Card.Content className="pt-0">
                        <div className="flex flex-col gap-5">
                            {isLoggedIn ? (
                                <CommentComposer
                                    draft={composer.draft}
                                    isPosting={composer.isPosting}
                                    onDraftChange={composer.setDraft}
                                    onSubmit={composer.submit}
                                />
                            ) : (
                                <SignInPrompt />
                            )}

                            <Tabs.Panel className="pt-4" id="time">
                                {isLoading ? (
                                    <CommentsSkeleton />
                                ) : threads.length === 0 ? (
                                    <EmptyComments />
                                ) : (
                                    renderThreads(threads, threadContext)
                                )}
                            </Tabs.Panel>
                            <Tabs.Panel className="pt-4" id="popular">
                                {isLoading ? (
                                    <CommentsSkeleton />
                                ) : threads.length === 0 ? (
                                    <EmptyComments />
                                ) : (
                                    renderThreads(threads, threadContext)
                                )}
                            </Tabs.Panel>
                        </div>
                    </Card.Content>
                </Tabs>
            </Card>

            <ConfirmDialog
                state={deleteState}
                heading="删除评论"
                description="确定删除这条评论吗？其回复将一并删除，此操作不可恢复。"
                confirmLabel="删除评论"
                onConfirm={confirmDelete}
            />
        </>
    );
});

const INITIAL_VISIBLE_CHILDREN = 3;

const MAX_INDENT_DEPTH = 3;

const REPLY_CONTAINER_CLASS =
    "ml-12 mt-1 mb-2 pl-4 border-l-2 border-default-200/70 flex flex-col gap-1";

/**
 * 统计评论总数，子评论与更深层级的子子评论一并计入。
 * @param nodes - 子评论节点。
 * @returns 所有层级的评论总数。
 */
function countComments(nodes: CommentNode[]): number {
    let count = 0;
    for (const node of nodes) {
        count += 1;
        count += countComments(node.children);
    }
    return count;
}

function containsComment(
    node: CommentNode,
    id: string | null | undefined,
): boolean {
    if (!id) {
        return false;
    }
    if (node.comment.id === id) {
        return true;
    }
    return node.children.some((child) => containsComment(child, id));
}

function CommentBranch({
    comment,
    replies,
    depth,
    replyToName,
    canReply,
    currentUserId,
    canModerate,
    submitComment,
    focusCommentId,
    onReload,
    onDelete,
    onPin,
    onLike,
}: {
    comment: Comment;
    replies: CommentNode[];
    depth: number;
    replyToName?: string;
    canReply: boolean;
    currentUserId?: string | null;
    canModerate: boolean;
    submitComment: SubmitComment;
    focusCommentId?: string | null;
    onReload: () => Promise<unknown>;
    onDelete: (commentId: string) => void;
    onPin: (commentId: string, pinned: boolean) => void;
    onLike: (commentId: string) => void;
}) {
    const [isReplying, setIsReplying] = useState(false);
    const [isExpanded, setIsExpanded] = useState(
        () =>
            focusCommentId != null &&
            replies.some((child) => containsComment(child, focusCommentId)),
    );

    const { draft, setDraft, isPosting, submit } = useCommentComposer(
        submitComment,
        onReload,
        comment.id,
    );

    const authorName = comment.author.name ?? "匿名";
    const isReply = depth > 0;

    const totalReplies = countComments(replies);
    const hasMoreReplies = totalReplies > INITIAL_VISIBLE_CHILDREN;
    const isCollapsed = hasMoreReplies && !isExpanded;
    const visibleReplies = isCollapsed
        ? replies.slice(0, INITIAL_VISIBLE_CHILDREN)
        : replies;

    const closeReply = useCallback(() => {
        setIsReplying(false);
        setDraft("");
    }, [setDraft]);

    const submitReply = useCallback(async () => {
        if (await submit()) {
            setIsReplying(false);
        }
    }, [submit]);

    return (
        <div className="flex flex-col">
            <CommentRow
                comment={comment}
                isReply={isReply}
                canReply={canReply}
                focus={focusCommentId === comment.id}
                replyToName={replyToName}
                onReply={() => setIsReplying(true)}
                currentUserId={currentUserId}
                canModerate={canModerate}
                onDelete={() => onDelete(comment.id)}
                onPin={(pinned) => onPin(comment.id, pinned)}
                onLike={() => onLike(comment.id)}
            />
            {isReplying && (
                <div className={isReply ? "pt-1 pb-2" : "ml-12 mt-1 mb-2 pl-4"}>
                    <CommentComposer
                        draft={draft}
                        isPosting={isPosting}
                        replyTarget={{ name: authorName }}
                        onDraftChange={setDraft}
                        onCancelReply={closeReply}
                        onSubmit={submitReply}
                    />
                </div>
            )}
            {replies.length > 0 && (
                <div
                    className={
                        depth < MAX_INDENT_DEPTH
                            ? REPLY_CONTAINER_CLASS
                            : "mt-1 flex flex-col gap-1"
                    }
                >
                    {visibleReplies.map((child) => (
                        <CommentBranch
                            key={child.comment.id}
                            comment={child.comment}
                            replies={isCollapsed ? [] : (child.children ?? [])}
                            depth={depth + 1}
                            replyToName={authorName}
                            canReply={canReply}
                            currentUserId={currentUserId}
                            canModerate={canModerate}
                            submitComment={submitComment}
                            focusCommentId={focusCommentId}
                            onReload={onReload}
                            onDelete={onDelete}
                            onPin={onPin}
                            onLike={onLike}
                        />
                    ))}
                    {hasMoreReplies && (
                        <button
                            type="button"
                            onClick={() => setIsExpanded((value) => !value)}
                            className="w-fit text-xs text-foreground/50 hover:text-primary transition-colors"
                        >
                            {isExpanded
                                ? "收起回复"
                                : `展开全部 ${totalReplies} 条回复`}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function CommentsSkeleton() {
    return (
        <div className="flex flex-col gap-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
        </div>
    );
}

function EmptyComments() {
    return (
        <div className="flex flex-col items-center gap-2.5 py-10 text-foreground/40">
            <div className="size-12 rounded-full bg-default-100/70 flex items-center justify-center">
                <MessageCircle className="size-6" strokeWidth={1.5} />
            </div>
            <p className="text-sm">还没有评论，来抢沙发吧</p>
        </div>
    );
}
