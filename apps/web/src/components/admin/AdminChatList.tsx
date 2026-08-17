import { Avatar, Button, Skeleton, Spinner } from "@heroui/react";
import { MessageSquare, Trash2 } from "lucide-react";
import { EmptyState } from "~/components/ui/EmptyState";
import type { AdminConversation } from "~/lib/api/admin";
import { formatDate } from "~/lib/format";

interface AdminChatListProps {
    conversations: AdminConversation[];
    activeId?: string;
    isLoading: boolean;
    onSelect: (id: string) => void;
    onRequestDelete: (conversation: AdminConversation) => void;
}

/**
 * 管理后台会话列表：展示双方用户、消息概况，支持删除会话。
 */
export function AdminChatList({
    conversations,
    activeId,
    isLoading,
    onSelect,
    onRequestDelete,
}: AdminChatListProps) {
    if (isLoading) {
        return <ChatListSkeleton />;
    }
    if (conversations.length === 0) {
        return (
            <EmptyState
                icon={MessageSquare}
                title="暂无会话"
                hint="没有符合条件的私信会话"
            />
        );
    }

    return (
        <div className="flex flex-col gap-1">
            {conversations.map((conversation) => (
                <ChatItem
                    key={conversation.id}
                    conversation={conversation}
                    isActive={conversation.id === activeId}
                    onSelect={onSelect}
                    onRequestDelete={onRequestDelete}
                />
            ))}
        </div>
    );
}

function ChatItem({
    conversation,
    isActive,
    onSelect,
    onRequestDelete,
}: {
    conversation: AdminConversation;
    isActive: boolean;
    onSelect: (id: string) => void;
    onRequestDelete: (conversation: AdminConversation) => void;
}) {
    const { user1, user2 } = conversation;
    const title = `${user1.name ?? "未命名用户"} 与 ${user2.name ?? "未命名用户"}`;

    return (
        <div
            className={`group flex items-center rounded-xl transition-colors ${
                isActive ? "bg-hover-strong" : "hover:bg-hover"
            }`}
        >
            <button
                type="button"
                onClick={() => onSelect(conversation.id)}
                className="flex-1 min-w-0 text-left flex items-center gap-3 px-3 py-2.5"
            >
                <Avatar size="sm" className="shrink-0">
                    {user1.image ? (
                        <Avatar.Image
                            alt={user1.name ?? "用户"}
                            src={user1.image}
                        />
                    ) : null}
                    <Avatar.Fallback>
                        {(user1.name ?? "用").trim().charAt(0).toUpperCase()}
                    </Avatar.Fallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">
                            {title}
                        </span>
                        {conversation.lastMessageAt && (
                            <span className="text-[11px] text-foreground/50 tabular-nums shrink-0">
                                {formatDate(conversation.lastMessageAt)}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-foreground/45 truncate mt-0.5">
                        {conversation.lastMessage ?? "暂无消息"}
                    </p>
                    <p className="text-[11px] text-foreground/50 mt-0.5 tabular-nums">
                        {conversation.messageCount.toLocaleString()} 条消息
                    </p>
                </div>
            </button>
            <Button
                variant="ghost"
                size="sm"
                isIconOnly
                aria-label={`删除会话：${title}`}
                className="mr-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-danger"
                onPress={() => onRequestDelete(conversation)}
            >
                <Trash2 className="size-3.5" />
            </Button>
        </div>
    );
}

function ChatListSkeleton() {
    return (
        <div className="flex flex-col gap-1">
            {["a", "b", "c", "d", "e"].map((id) => (
                <div key={id} className="flex items-center gap-3 px-3 py-2.5">
                    <Skeleton className="size-8 rounded-full shrink-0" />
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                        <Skeleton className="h-3 w-1/2 rounded" />
                        <Skeleton className="h-3 w-2/3 rounded" />
                    </div>
                </div>
            ))}
            <div className="flex items-center justify-center gap-2 text-foreground/40 py-2">
                <Spinner size="sm" />
                <span className="text-xs">正在加载会话…</span>
            </div>
        </div>
    );
}
