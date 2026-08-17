import { Avatar, Button } from "@heroui/react";
import { ArrowLeft, MessageSquare, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "~/components/ui/EmptyState";
import { LoadingState } from "~/components/ui/LoadingState";
import type { AdminConversation, AdminMessage } from "~/lib/api/admin";
import { formatDate } from "~/lib/format";

interface AdminChatViewProps {
    conversation: AdminConversation | undefined;
    messages: AdminMessage[];
    isLoading: boolean;
    onBack: () => void;
    onRequestDeleteMessage: (message: AdminMessage) => void;
    onRequestDeleteConversation: (conversation: AdminConversation) => void;
}

/**
 * 管理后台聊天视图：只读展示双方消息，支持逐条删除与删除会话。
 */
export function AdminChatView({
    conversation,
    messages,
    isLoading,
    onBack,
    onRequestDeleteMessage,
    onRequestDeleteConversation,
}: AdminChatViewProps) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [userScrolled, setUserScrolled] = useState(false);
    const user1Id = conversation?.user1.id;
    const title = conversation
        ? `${conversation.user1.name ?? "未命名用户"} 与 ${conversation.user2.name ?? "未命名用户"}`
        : "会话详情";
    const subtitle = conversation
        ? `${conversation.user1.email ?? "无邮箱"} · ${conversation.user2.email ?? "无邮箱"}`
        : "私信记录";

    // biome-ignore lint/correctness/useExhaustiveDependencies: 依赖仅用于在切换会话/新消息时触发滚动
    useEffect(() => {
        setUserScrolled(false);
        bottomRef.current?.scrollIntoView({ block: "end" });
    }, [conversation?.id]);

    useEffect(() => {
        if (messages.length > 0 && !userScrolled) {
            bottomRef.current?.scrollIntoView({ block: "end" });
        }
    }, [messages, userScrolled]);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        const isNearBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight < 50;
        setUserScrolled(!isNearBottom);
    }, []);

    return (
        <div className="flex flex-col h-full min-w-0">
            <header className="flex items-center gap-2 px-4 py-3 border-b border-default-100 shrink-0">
                <Button
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    aria-label="返回会话列表"
                    className="md:hidden"
                    onPress={onBack}
                >
                    <ArrowLeft className="size-4" />
                </Button>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{title}</p>
                    <p className="text-[11px] text-foreground/40 truncate">
                        {subtitle}
                    </p>
                </div>
                {conversation && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger shrink-0"
                        onPress={() =>
                            onRequestDeleteConversation(conversation)
                        }
                    >
                        <Trash2 className="size-3.5" />
                        <span className="hidden sm:inline">删除会话</span>
                    </Button>
                )}
            </header>

            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 py-4"
            >
                {isLoading ? (
                    <LoadingState text="正在加载消息…" />
                ) : messages.length === 0 ? (
                    <EmptyState
                        icon={MessageSquare}
                        title="暂无消息"
                        hint="该会话没有可显示的消息"
                    />
                ) : (
                    <div className="flex flex-col gap-3">
                        {[...messages].reverse().map((message) => (
                            <ChatMessageBubble
                                key={message.id}
                                message={message}
                                alignRight={message.senderId === user1Id}
                                onRequestDelete={onRequestDeleteMessage}
                            />
                        ))}
                        <div ref={bottomRef} />
                    </div>
                )}
            </div>
        </div>
    );
}

function ChatMessageBubble({
    message,
    alignRight,
    onRequestDelete,
}: {
    message: AdminMessage;
    alignRight: boolean;
    onRequestDelete: (message: AdminMessage) => void;
}) {
    return (
        <div
            className={`group flex gap-2.5 ${alignRight ? "flex-row-reverse" : "flex-row"}`}
        >
            <Avatar size="sm" className="shrink-0 mt-1">
                {message.sender.image ? (
                    <Avatar.Image
                        alt={message.sender.name ?? "用户"}
                        src={message.sender.image}
                    />
                ) : null}
                <Avatar.Fallback>
                    {(message.sender.name ?? "用")
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                </Avatar.Fallback>
            </Avatar>
            <div
                className={`flex flex-col ${alignRight ? "items-end" : "items-start"} max-w-[75%]`}
            >
                <div
                    className={`flex items-center gap-2 ${alignRight ? "flex-row-reverse" : ""}`}
                >
                    <span className="text-[11px] text-foreground/50">
                        {message.sender.name ?? "未命名用户"}
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        isIconOnly
                        aria-label="删除此消息"
                        className="size-6 min-w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-danger"
                        onPress={() => onRequestDelete(message)}
                    >
                        <Trash2 className="size-3" />
                    </Button>
                </div>
                <div
                    className={`mt-0.5 px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed wrap-break-words bg-default-100/70 border border-default-200/70 text-foreground ${
                        alignRight ? "rounded-br-md" : "rounded-bl-md"
                    }`}
                >
                    {message.content}
                </div>
                <span className="text-[11px] text-foreground/50 mt-1 px-1 tabular-nums">
                    {formatDate(message.createdAt)}
                    {message.read ? "" : " · 未读"}
                </span>
            </div>
        </div>
    );
}
