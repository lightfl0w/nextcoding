import { Avatar } from "@heroui/react";
import { MessageCircle } from "lucide-react";
import type { Comment } from "~/lib/api";
import { formatDate } from "~/lib/format";

const ANONYMOUS_NAME = "匿名";

interface CommentRowProps {
    comment: Comment;
    isReply?: boolean;
    canReply: boolean;
    focus?: boolean;
    replyToName?: string | null;
    onReply?: (name: string) => void;
}

export function CommentRow({
    comment,
    isReply = false,
    canReply,
    focus = false,
    replyToName,
    onReply,
}: CommentRowProps) {
    const authorName = comment.author.name ?? ANONYMOUS_NAME;
    const targetName = replyToName ?? ANONYMOUS_NAME;

    return (
        <div
            id={`comment-${comment.id}`}
            className={`py-2.5 px-3 -mx-3 rounded-lg transition-colors flex gap-3 group ${
                focus ? "bg-accent/10 ring-1 ring-accent/40" : "hover:bg-hover"
            }`}
        >
            <Avatar size="sm" className="shrink-0">
                <Avatar.Image
                    src={comment.author.image ?? ""}
                    alt={authorName}
                />
                <Avatar.Fallback>
                    {authorName.charAt(0).toUpperCase()}
                </Avatar.Fallback>
            </Avatar>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground/90">
                        {authorName}
                    </span>
                    {isReply && (
                        <span className="text-xs text-foreground/40">
                            回复{" "}
                            <span className="text-primary/80">
                                {targetName}
                            </span>
                        </span>
                    )}
                    <span className="text-xs text-foreground/40">
                        {formatDate(comment.createdAt)}
                    </span>
                </div>
                <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap wrap-break-word">
                    {comment.content}
                </p>
                {canReply && onReply && (
                    <button
                        type="button"
                        onClick={() => onReply(authorName)}
                        className={`flex items-center gap-1 text-xs text-foreground/50 hover:text-primary w-fit transition-colors focus-visible:text-primary focus-visible:opacity-100 ${
                            isReply ? "" : "opacity-0 group-hover:opacity-100"
                        }`}
                    >
                        <MessageCircle className="size-3.5" />
                        回复
                    </button>
                )}
            </div>
        </div>
    );
}
