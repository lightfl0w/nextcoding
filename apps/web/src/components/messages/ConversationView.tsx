import { Spinner } from "@heroui/react";
import { MessageSquare } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { EmptyState } from "~/components/ui/EmptyState";
import { useAuth } from "~/hooks/useAuth";
import { useMessages } from "~/hooks/useMessages";
import { markConversationRead, sendMessage } from "~/lib/api/messages";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";

interface ConversationViewProps {
    conversationId: string;
}

export function ConversationView({ conversationId }: ConversationViewProps) {
    const { user } = useAuth();
    const { messages, isLoading, mutate } = useMessages(conversationId);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        markConversationRead(conversationId).then(() => {
            mutate();
        });
    }, [conversationId, mutate]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    const handleSend = useCallback(
        async (content: string) => {
            const message = await sendMessage(conversationId, content);
            await mutate((prev) => (prev ? [...prev, message] : [message]), {
                revalidate: false,
            });
        },
        [conversationId, mutate],
    );

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-foreground/40">
                <Spinner size="sm" />
                <span className="text-sm">正在加载消息…</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto px-4 py-4">
                {messages.length === 0 ? (
                    <EmptyState
                        icon={MessageSquare}
                        title="暂无消息"
                        hint="发送第一条消息开始对话吧"
                    />
                ) : (
                    <div className="flex flex-col gap-3">
                        {messages.map((message) => (
                            <MessageBubble
                                key={message.id}
                                message={message}
                                isOwn={message.senderId === user?.id}
                            />
                        ))}
                        <div ref={bottomRef} />
                    </div>
                )}
            </div>
            <MessageInput onSend={handleSend} />
        </div>
    );
}
