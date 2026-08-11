import { Card, Skeleton } from "@heroui/react";
import { MessageCircle } from "lucide-react";
import { memo } from "react";
import type { KeyedMutator } from "swr";
import { useAuth } from "~/hooks/useAuth";
import { useCommentComposer } from "~/hooks/useCommentComposer";
import {
    type CommentThread,
    useCommentThreads,
} from "~/hooks/useCommentThreads";
import type { Comment } from "~/lib/api";
import { CommentComposer, SignInPrompt } from "./CommentComposer";
import { CommentRow } from "./CommentRow";

interface CommentsSectionProps {
    workId: string;
    comments: Comment[] | undefined;
    isLoading: boolean;
    mutate: KeyedMutator<Comment[]>;
}

export const CommentsSection = memo(function CommentsSection({
    workId,
    comments,
    isLoading,
    mutate,
}: CommentsSectionProps) {
    const { isLoggedIn } = useAuth();
    const composer = useCommentComposer(workId, mutate);
    const threads = useCommentThreads(comments);

    return (
        <Card>
            <Card.Header>
                <Card.Title>评论</Card.Title>
            </Card.Header>

            <Card.Content>
                <div className="flex flex-col gap-5">
                    {isLoggedIn ? (
                        <CommentComposer
                            draft={composer.draft}
                            isPosting={composer.isPosting}
                            replyTarget={composer.replyTarget}
                            onDraftChange={composer.setDraft}
                            onCancelReply={composer.clearReplyTarget}
                            onSubmit={composer.submit}
                        />
                    ) : (
                        <SignInPrompt />
                    )}

                    {isLoading && <CommentsSkeleton />}
                    {!isLoading && threads.length === 0 && <EmptyComments />}

                    <div className="flex flex-col gap-1">
                        {threads.map((thread) => (
                            <ThreadBlock
                                key={thread.root.id}
                                thread={thread}
                                canReply={isLoggedIn}
                                onReply={(name) =>
                                    composer.setReplyTarget({
                                        rootId: thread.root.id,
                                        name,
                                    })
                                }
                            />
                        ))}
                    </div>
                </div>
            </Card.Content>
        </Card>
    );
});

function ThreadBlock({
    thread,
    canReply,
    onReply,
}: {
    thread: CommentThread;
    canReply: boolean;
    onReply: (name: string) => void;
}) {
    return (
        <div className="flex flex-col">
            <CommentRow
                comment={thread.root}
                canReply={canReply}
                onReply={onReply}
            />
            {thread.replies.length > 0 && (
                <div className="ml-12 mt-1 mb-2 pl-4 border-l-2 border-default-200/70 flex flex-col gap-1">
                    {thread.replies.map((reply) => (
                        <CommentRow
                            key={reply.id}
                            comment={reply}
                            isReply
                            canReply={canReply}
                            onReply={onReply}
                        />
                    ))}
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
