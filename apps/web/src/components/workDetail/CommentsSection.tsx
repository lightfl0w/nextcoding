import { Card, Skeleton, toast } from "@heroui/react";
import { MessageCircle } from "lucide-react";
import { memo, useCallback, useState } from "react";
import type { KeyedMutator } from "swr";
import { useAuth } from "~/hooks/useAuth";
import { useCommentComposer } from "~/hooks/useCommentComposer";
import { type CommentNode, useCommentThreads } from "~/hooks/useCommentThreads";
import type { Comment } from "~/lib/api";
import { postComment } from "~/lib/api";
import { CommentComposer, SignInPrompt } from "./CommentComposer";
import { CommentRow } from "./CommentRow";

interface CommentsSectionProps {
    workId: string;
    comments: Comment[] | undefined;
    isLoading: boolean;
    mutate: KeyedMutator<Comment[]>;
    focusCommentId?: string | null;
}

export const CommentsSection = memo(function CommentsSection({
    workId,
    comments,
    isLoading,
    mutate,
    focusCommentId,
}: CommentsSectionProps) {
    const { isLoggedIn } = useAuth();
    const composer = useCommentComposer(workId, mutate);
    const threads = useCommentThreads(comments);

    return (
        <Card className="shadow-none rounded-2xl border border-default-200/70">
            <Card.Header>
                <Card.Title>评论</Card.Title>
            </Card.Header>

            <Card.Content>
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

                    {isLoading && <CommentsSkeleton />}
                    {!isLoading && threads.length === 0 && <EmptyComments />}

                    <div className="flex flex-col gap-1">
                        {threads.map((thread) => (
                            <CommentBranch
                                key={thread.root.id}
                                comment={thread.root}
                                replies={thread.children}
                                depth={0}
                                canReply={isLoggedIn}
                                workId={workId}
                                focusCommentId={focusCommentId}
                                onReload={mutate}
                            />
                        ))}
                    </div>
                </div>
            </Card.Content>
        </Card>
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
    workId,
    focusCommentId,
    onReload,
}: {
    comment: Comment;
    replies: CommentNode[];
    depth: number;
    replyToName?: string;
    canReply: boolean;
    workId: string;
    focusCommentId?: string | null;
    onReload: () => Promise<unknown>;
}) {
    const [isReplying, setIsReplying] = useState(false);
    const [draft, setDraft] = useState("");
    const [isPosting, setIsPosting] = useState(false);
    const [isExpanded, setIsExpanded] = useState(
        () =>
            focusCommentId != null &&
            replies.some((child) => containsComment(child, focusCommentId)),
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
    }, []);

    const submitReply = useCallback(async () => {
        const content = draft.trim();
        if (!content || isPosting || !isReplying) {
            return;
        }

        setIsPosting(true);
        try {
            await postComment(workId, content, comment.id);
            setDraft("");
            setIsReplying(false);
            await onReload();
        } catch (error) {
            toast.danger((error as Error).message);
        } finally {
            setIsPosting(false);
        }
    }, [workId, draft, isPosting, isReplying, comment.id, onReload]);

    return (
        <div className="flex flex-col">
            <CommentRow
                comment={comment}
                isReply={isReply}
                canReply={canReply}
                focus={focusCommentId === comment.id}
                replyToName={replyToName}
                onReply={() => setIsReplying(true)}
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
                            workId={workId}
                            focusCommentId={focusCommentId}
                            onReload={onReload}
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
