import { Button, toast } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import {
    MessagesSidebar,
    MobileTypeFilter,
} from "~/components/messages/MessagesSidebar";
import { NotificationFeed } from "~/components/messages/NotificationFeed";
import { PageHeader } from "~/components/ui/PageHeader";
import { useNotifications } from "~/hooks/useNotifications";
import { markNotificationRead, markNotificationsRead } from "~/lib/api";
import {
    countNotifications,
    groupNotifications,
    type NotificationFilter,
    type NotificationTypeFilter,
} from "~/lib/notifications";

export const Route = createFileRoute("/messages")({
    component: MessageCenterRoute,
});

function MessageCenterRoute() {
    const { notifications, isLoading, mutate } = useNotifications();
    const [readFilter, setReadFilter] = useState<NotificationFilter>("all");
    const [typeFilter, setTypeFilter] = useState<NotificationTypeFilter>("all");

    const counts = useMemo(
        () => countNotifications(notifications),
        [notifications],
    );

    const filtered = useMemo(() => {
        return notifications.filter((item) => {
            if (readFilter === "unread" && item.read) {
                return false;
            }
            if (typeFilter !== "all" && item.type !== typeFilter) {
                return false;
            }
            return true;
        });
    }, [notifications, readFilter, typeFilter]);

    const groups = useMemo(() => groupNotifications(filtered), [filtered]);

    const markAllRead = async () => {
        try {
            await markNotificationsRead();
            mutate(
                (current = []) =>
                    current.map((item) => ({ ...item, read: true })),
                false,
            );
        } catch (error) {
            toast.danger((error as Error).message);
        }
    };

    const markRead = async (id: string) => {
        try {
            await markNotificationRead(id);
            mutate(
                (current = []) =>
                    current.map((item) =>
                        item.id === id ? { ...item, read: true } : item,
                    ),
                false,
            );
        } catch (error) {
            toast.danger((error as Error).message);
        }
    };

    return (
        <div className="mx-auto w-full max-w-6xl p-8 flex flex-col gap-6 md:grid md:gap-8 md:grid-cols-[minmax(0,1fr)_220px]">
            <main className="flex min-w-0 flex-col gap-6 order-2 md:order-1">
                <PageHeader
                    title="消息中心"
                    description="收到火花、二创与评论时都会通知你"
                    action={
                        counts.unread > 0 ? (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="gap-1.5 shrink-0"
                                onPress={markAllRead}
                            >
                                <Check className="size-3.5" />
                                全部已读
                            </Button>
                        ) : undefined
                    }
                />

                <div className="md:hidden">
                    <MobileTypeFilter
                        typeFilter={typeFilter}
                        onTypeFilterChange={setTypeFilter}
                        counts={counts}
                    />
                </div>

                <NotificationFeed
                    isLoading={isLoading}
                    filtered={filtered}
                    groups={groups}
                    counts={counts}
                    readFilter={readFilter}
                    typeFilter={typeFilter}
                    onReadFilterChange={setReadFilter}
                    onMarkRead={markRead}
                />
            </main>

            <div className="order-1 md:order-2">
                <MessagesSidebar
                    counts={counts}
                    typeFilter={typeFilter}
                    onTypeFilterChange={setTypeFilter}
                />
            </div>
        </div>
    );
}
