import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { EmptyState } from "~/components/ui/EmptyState";

export const Route = createFileRoute("/chat/")({
    component: ChatIndexPage,
});

function ChatIndexPage() {
    return (
        <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState
                icon={MessageSquare}
                title="选择一个会话"
                hint="从左侧列表选择会话开始聊天"
            />
        </div>
    );
}
