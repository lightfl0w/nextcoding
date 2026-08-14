import { Avatar } from "@heroui/react";
import { memo } from "react";
import type { Message } from "~/lib/api/messages";
import { formatDate } from "~/lib/format";

interface MessageBubbleProps {
    message: Message;
    isOwn: boolean;
}

export const MessageBubble = memo(function MessageBubble({
    message,
    isOwn,
}: MessageBubbleProps) {
    return (
        <div
            className={`flex gap-2.5 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
        >
            {!isOwn && (
                <Avatar size="sm" className="shrink-0 mt-1">
                    {message.sender.image ? (
                        <Avatar.Image
                            alt={message.sender.name ?? "用户"}
                            src={message.sender.image}
                        />
                    ) : null}
                    <Avatar.Fallback>
                        {(message.sender.name ?? "用").charAt(0).toUpperCase()}
                    </Avatar.Fallback>
                </Avatar>
            )}
            <div
                className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[75%]`}
            >
                <div
                    className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                        isOwn
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-default-100/70 border border-default-200/70 text-foreground rounded-bl-md"
                    }`}
                >
                    {message.content}
                </div>
                <span className="text-[11px] text-foreground/35 mt-1 px-1 tabular-nums">
                    {formatDate(message.createdAt)}
                </span>
            </div>
        </div>
    );
});
