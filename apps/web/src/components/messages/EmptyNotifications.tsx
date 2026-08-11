import { Button, Card } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import type {
    NotificationFilter,
    NotificationTypeFilter,
} from "~/lib/notifications";

export function EmptyNotifications({
    readFilter,
    typeFilter,
}: {
    readFilter: NotificationFilter;
    typeFilter: NotificationTypeFilter;
}) {
    const isUnread = readFilter === "unread";
    const typeLabel =
        typeFilter === "spark"
            ? "火花"
            : typeFilter === "remix"
              ? "二创"
              : typeFilter === "comment"
                ? "评论"
                : "";

    const title = isUnread
        ? "没有未读通知"
        : typeFilter !== "all"
          ? `还没有${typeLabel}通知`
          : "还没有通知";
    const hint = isUnread
        ? "已读通知会自动归档到这里"
        : typeFilter !== "all"
          ? `试试切换到其他分类，或者去发现页看看`
          : "快去发现页逛逛，给喜欢的作品送火花吧";

    return (
        <Card className="p-0 shadow-none rounded-2xl border border-dashed border-default-300 bg-background">
            <Card.Content className="py-16 flex flex-col items-center gap-3 text-foreground/45">
                <div className="size-12 rounded-full bg-default-100/70 flex items-center justify-center">
                    <Bell className="size-6" strokeWidth={1.5} />
                </div>
                <div className="flex flex-col items-center gap-1">
                    <p className="text-sm font-medium text-foreground/65">
                        {title}
                    </p>
                    <p className="text-xs text-foreground/40">{hint}</p>
                </div>
                {!isUnread && typeFilter === "all" && (
                    <Link to="/discover" className="mt-1">
                        <Button size="sm" variant="ghost">
                            去发现好作品
                        </Button>
                    </Link>
                )}
            </Card.Content>
        </Card>
    );
}
