import { Avatar } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { memo } from "react";
import { EmptyState } from "~/components/ui/EmptyState";
import { LoadingState } from "~/components/ui/LoadingState";
import type { Conversation } from "~/lib/api/messages";
import { formatDate } from "~/lib/format";

export function ConversationList({
    conversations,
    activeId,
    isLoading,
}: {
    conversations: Conversation[];
    activeId?: string;
    isLoading?: boolean;
}) {
    if (isLoading) {
        return <LoadingState text="正在加载会话…" />;
    }

    if (conversations.length === 0) {
        return (
            <EmptyState
                icon={MessageCircle}
                title="暂无会话"
                hint="到用户主页点击「发私信」即可开始聊天"
            />
        );
    }

    return (
        <div className="flex flex-col gap-1">
            {conversations.map((conversation) => (
                <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isActive={conversation.id === activeId}
                />
            ))}
        </div>
    );
}

const ConversationItem = memo(function ConversationItem({
    conversation,
    isActive,
}: {
    conversation: Conversation;
    isActive: boolean;
}) {
    const { otherUser, lastMessage, lastMessageAt, unreadCount } = conversation;
    const name = otherUser.name ?? "未命名用户";

    return (
        <Link
            to="/chat/$id"
            params={{ id: conversation.id }}
            className={`block rounded-2xl transition-colors ${
                isActive
                    ? "bg-hover-strong border border-default-200/70"
                    : "hover:bg-hover border border-transparent"
            }`}
        >
            <div className="flex items-center gap-3 px-3 py-2.5">
                <Avatar size="sm" className="shrink-0">
                    {otherUser.image ? (
                        <Avatar.Image alt={name} src={otherUser.image} />
                    ) : null}
                    <Avatar.Fallback>
                        {name.charAt(0).toUpperCase()}
                    </Avatar.Fallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <span
                            className={`text-sm truncate ${
                                unreadCount > 0
                                    ? "font-medium text-foreground"
                                    : "text-foreground/80"
                            }`}
                        >
                            {name}
                        </span>
                        {lastMessageAt && (
                            <span className="text-xs text-foreground/40 tabular-nums shrink-0">
                                {formatDate(lastMessageAt)}
                            </span>
                        )}
                    </div>
                    {lastMessage && (
                        <p
                            className={`text-xs truncate mt-0.5 ${
                                unreadCount > 0
                                    ? "text-foreground/70 font-medium"
                                    : "text-foreground/45"
                            }`}
                        >
                            {lastMessage}
                        </p>
                    )}
                </div>
                {unreadCount > 0 && (
                    <span className="min-w-5 h-5 px-1.5 rounded-full bg-danger text-background text-[10px] font-semibold flex items-center justify-center tabular-nums shrink-0">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </div>
        </Link>
    );
});
