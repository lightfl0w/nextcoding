import { Avatar, Button } from "@heroui/react";
import { Undo2 } from "lucide-react";
import { memo } from "react";
import type { Message } from "~/lib/api/messages";
import { formatTime } from "~/lib/format";

interface MessageBubbleProps {
    message: Message;
    isOwn: boolean;
    onRecall?: (message: Message) => void;
}

export const MessageBubble = memo(function MessageBubble({
    message,
    isOwn,
    onRecall,
}: MessageBubbleProps) {
    const senderName = message.sender.name ?? "未命名用户";
    const align = isOwn ? "justify-end" : "justify-start";

    if (message.recalled) {
        return (
            <div className={`flex ${align}`}>
                <div className="flex max-w-[70%] items-center gap-2.5 px-1 py-1">
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-sm text-foreground/45 italic">
                            {`${senderName} 撤回了一条消息`}
                        </span>
                        <span className="text-[11px] text-foreground/45 tabular-nums">
                            {formatTime(message.createdAt)}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`group flex ${align}`}>
            <div
                className={`flex max-w-[70%] items-start gap-2.5 ${
                    isOwn ? "flex-row-reverse" : "flex-row"
                }`}
            >
                <BubbleAvatar name={senderName} image={message.sender.image} />
                <div
                    className={`flex min-w-0 flex-col ${
                        isOwn ? "items-end" : "items-start"
                    }`}
                >
                    <div
                        className={`mb-1 flex items-center gap-2 px-1 ${
                            isOwn ? "flex-row-reverse" : "flex-row"
                        }`}
                    >
                        {isOwn && onRecall && (
                            <Button
                                isIconOnly
                                variant="ghost"
                                size="sm"
                                onPress={() => onRecall(message)}
                                aria-label="撤回消息"
                                className="size-6 rounded-full opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 touch-manipulation"
                            >
                                <Undo2 className="size-3.5" />
                            </Button>
                        )}
                        <span className="text-xs text-foreground/60">
                            {senderName}
                        </span>
                        <span className="text-[11px] text-foreground/50 tabular-nums">
                            {formatTime(message.createdAt)}
                        </span>
                    </div>
                    <div
                        className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap ${
                            isOwn
                                ? "bg-primary text-primary-foreground rounded-br-md"
                                : "bg-default-100/70 border border-default-200/70 text-foreground rounded-bl-md"
                        }`}
                    >
                        {message.content}
                    </div>
                </div>
            </div>
        </div>
    );
});

function BubbleAvatar({ name, image }: { name: string; image: string | null }) {
    return (
        <Avatar size="sm" className="mt-1 shrink-0">
            {image ? <Avatar.Image alt={name} src={image} /> : null}
            <Avatar.Fallback>{name.charAt(0).toUpperCase()}</Avatar.Fallback>
        </Avatar>
    );
}
