import { Avatar, Spinner } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { memo } from "react";
import type { Conversation } from "~/lib/api/messages";
import { formatDate } from "~/lib/format";

interface ConversationListProps {
    conversations: Conversation[];
    activeId?: string;
    isLoading?: boolean;
}

export function ConversationList({
    conversations,
    activeId,
    isLoading,
}: ConversationListProps) {
    if (isLoading) {
        return <ConversationListSkeleton />;
    }

    if (conversations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-foreground/40">
                <p className="text-sm">暂无会话</p>
            </div>
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

    return (
        <Link
            to="/messages/$id"
            params={{ id: conversation.id }}
            className={`block rounded-2xl transition-colors ${
                isActive
                    ? "bg-default-100/70 border border-default-200/70"
                    : "hover:bg-default-100/50 border border-transparent"
            }`}
        >
            <div className="flex items-center gap-3 px-3 py-2.5">
                <Avatar size="sm" className="shrink-0">
                    {otherUser.image ? (
                        <Avatar.Image
                            alt={otherUser.name ?? "用户"}
                            src={otherUser.image}
                        />
                    ) : null}
                    <Avatar.Fallback>
                        {(otherUser.name ?? "用").charAt(0).toUpperCase()}
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
                            {otherUser.name ?? "未命名用户"}
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

function ConversationListSkeleton() {
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-foreground/40">
            <Spinner size="sm" />
            <span className="text-sm">正在加载会话…</span>
        </div>
    );
}
