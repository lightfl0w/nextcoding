import { Avatar } from "@heroui/react";
import { Heart, MessageCircle, Pin, Trash2 } from "lucide-react";
import type { Comment } from "~/lib/api";
import { formatCount, formatDate } from "~/lib/format";

const ANONYMOUS_NAME = "匿名";

interface CommentRowProps {
    comment: Comment;
    isReply?: boolean;
    canReply: boolean;
    focus?: boolean;
    replyToName?: string | null;
    onReply?: (name: string) => void;
    currentUserId?: string | null;
    canModerate?: boolean;
    onDelete?: () => void;
    onPin?: (pinned: boolean) => void;
    onLike?: () => void;
}

export function CommentRow({
    comment,
    isReply = false,
    canReply,
    focus = false,
    replyToName,
    onReply,
    currentUserId,
    canModerate = false,
    onDelete,
    onPin,
    onLike,
}: CommentRowProps) {
    const authorName = comment.author.name ?? ANONYMOUS_NAME;
    const targetName = replyToName ?? ANONYMOUS_NAME;
    const isOwn = !!currentUserId && currentUserId === comment.author.id;
    const canDelete = canModerate || isOwn;
    const likeCount = comment.likeCount ?? 0;
    const likedByMe = comment.likedByMe ?? false;

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
                    {comment.pinned && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-warning">
                            <Pin className="size-3" />
                            置顶
                        </span>
                    )}
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
                <div className="flex items-center gap-1 -ml-1 mt-0.5">
                    <button
                        type="button"
                        onClick={onLike}
                        className={`flex items-center gap-1 text-xs px-1.5 py-1 rounded-md transition-colors ${
                            likedByMe
                                ? "text-danger hover:text-danger/80"
                                : "text-foreground/50 hover:text-danger"
                        } focus-visible:text-danger`}
                    >
                        <Heart
                            className="size-3.5"
                            fill={likedByMe ? "currentColor" : "none"}
                        />
                        {likeCount > 0 && <span>{formatCount(likeCount)}</span>}
                    </button>
                    {canReply && onReply && (
                        <button
                            type="button"
                            onClick={() => onReply(authorName)}
                            className={`flex items-center gap-1 text-xs text-foreground/50 hover:text-primary px-1.5 py-1 rounded-md transition-colors focus-visible:text-primary ${
                                isReply
                                    ? ""
                                    : "opacity-0 group-hover:opacity-100"
                            }`}
                        >
                            <MessageCircle className="size-3.5" />
                            回复
                        </button>
                    )}
                    {canModerate && !isReply && onPin && (
                        <button
                            type="button"
                            onClick={() => onPin(!comment.pinned)}
                            className="flex items-center gap-1 text-xs text-foreground/50 hover:text-warning px-1.5 py-1 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        >
                            <Pin className="size-3.5" />
                            {comment.pinned ? "取消置顶" : "置顶"}
                        </button>
                    )}
                    {canDelete && onDelete && (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="flex items-center gap-1 text-xs text-foreground/50 hover:text-danger px-1.5 py-1 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        >
                            <Trash2 className="size-3.5" />
                            删除
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
