import { Button, Spinner } from "@heroui/react";
import { Link, useLocation } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import {
    COMMENT_MAX_LENGTH,
    type ReplyTarget,
} from "~/hooks/useCommentComposer";

interface CommentComposerProps {
    draft: string;
    isPosting: boolean;
    replyTarget: ReplyTarget | null;
    onDraftChange: (value: string) => void;
    onCancelReply: () => void;
    onSubmit: () => void;
}

export function CommentComposer({
    draft,
    isPosting,
    replyTarget,
    onDraftChange,
    onCancelReply,
    onSubmit,
}: CommentComposerProps) {
    return (
        <div className="rounded-xl border border-default-200 bg-default-50/40 transition-all focus-within:border-primary focus-within:bg-background focus-within:shadow-sm">
            {replyTarget && (
                <div className="flex items-center gap-2 px-3.5 pt-2.5">
                    <span className="text-xs text-primary bg-primary/10 rounded-full px-2 py-0.5 font-medium">
                        回复 @{replyTarget.name}
                    </span>
                    <button
                        type="button"
                        onClick={onCancelReply}
                        className="text-xs text-foreground/45 hover:text-foreground transition-colors"
                    >
                        取消
                    </button>
                </div>
            )}
            <textarea
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                placeholder={
                    replyTarget ? `回复 @${replyTarget.name}…` : "说点什么吧 ~"
                }
                rows={3}
                maxLength={COMMENT_MAX_LENGTH}
                className="w-full resize-none bg-transparent px-3.5 pt-3 text-sm outline-none placeholder:text-foreground/40"
            />
            <div className="flex items-center justify-between px-3.5 pb-2.5">
                <span className="text-xs text-foreground/40 tabular-nums">
                    {draft.length}/{COMMENT_MAX_LENGTH}
                </span>
                <Button
                    size="sm"
                    variant="primary"
                    onPress={onSubmit}
                    isDisabled={!draft.trim() || isPosting}
                    className="gap-1.5"
                >
                    {isPosting && <Spinner size="sm" color="current" />}
                    {submitLabel(isPosting, replyTarget !== null)}
                </Button>
            </div>
        </div>
    );
}

export function SignInPrompt() {
    const location = useLocation();

    return (
        <div className="rounded-xl border border-dashed border-default-300 px-4 py-4 text-sm text-foreground/65 flex items-center gap-2 bg-default-50/30">
            <MessageCircle
                className="size-4 text-foreground/40"
                strokeWidth={1.75}
            />
            <span>
                <Link
                    to="/auth"
                    search={{ mode: "login", redirect: location.pathname }}
                    className="text-primary font-medium hover:underline"
                >
                    登录
                </Link>{" "}
                后即可参与评论
            </span>
        </div>
    );
}

function submitLabel(isPosting: boolean, isReplying: boolean): string {
    if (isPosting) return "发表中…";
    return isReplying ? "发表回复" : "发表评论";
}
