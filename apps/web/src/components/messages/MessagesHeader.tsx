import { Button } from "@heroui/react";
import { Check } from "lucide-react";

export function MessagesHeader({
    unreadCount,
    onMarkAllRead,
}: {
    unreadCount: number;
    onMarkAllRead: () => void;
}) {
    return (
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1 min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-balance">
                    消息中心
                </h1>
            </div>
            {unreadCount > 0 && (
                <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 self-start sm:self-auto"
                    onPress={onMarkAllRead}
                >
                    <Check className="size-3.5" />
                    全部已读
                </Button>
            )}
        </header>
    );
}
