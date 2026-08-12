import { Chip } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, GitFork, MessageSquare, Sparkles } from "lucide-react";
import type { AppNotification } from "~/lib/api";
import { formatDate } from "~/lib/format";
import {
    formatTimeOfDay,
    type NotificationGroup,
    notificationText,
} from "~/lib/notifications";

export function NotificationList({ groups }: { groups: NotificationGroup[] }) {
    return (
        <div className="flex flex-col gap-8">
            {groups.map((group) => (
                <section key={group.key} className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-medium text-foreground/45 uppercase tracking-wider">
                            {group.label}
                        </h2>
                        <span className="text-xs text-foreground/40 tabular-nums">
                            {group.items.length} 条
                        </span>
                    </div>
                    <div className="flex flex-col">
                        {group.items.map((item, itemIndex) => (
                            <NotificationRow
                                key={item.id}
                                item={item}
                                isLast={itemIndex === group.items.length - 1}
                            />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

function NotificationRow({
    item,
    isLast,
}: {
    item: AppNotification;
    isLast: boolean;
}) {
    return (
        <div className="group">
            {item.work ? (
                <Link
                    to="/work/$id"
                    params={{ id: item.work.id }}
                    {...(item.comment
                        ? { search: { comment: item.comment.id } }
                        : {})}
                    className={`block transition-colors hover:bg-default-100/60 ${
                        !isLast ? "" : "rounded-b-2xl"
                    }`}
                >
                    <NotificationCard item={item} isLast={isLast} />
                </Link>
            ) : (
                <NotificationCard item={item} isLast={isLast} />
            )}
        </div>
    );
}

function NotificationCard({
    item,
    isLast,
}: {
    item: AppNotification;
    isLast: boolean;
}) {
    const variant =
        item.type === "spark"
            ? { tile: "bg-warning/15 text-warning", Icon: Sparkles }
            : item.type === "comment"
              ? { tile: "bg-success/15 text-success", Icon: MessageSquare }
              : { tile: "bg-accent/10 text-accent", Icon: GitFork };
    const tileColor = variant.tile;
    const Icon = variant.Icon;

    return (
        <div
            className={`relative grid gap-3 md:gap-4 md:grid-cols-[88px_minmax(0,1fr)_auto] items-center px-4 py-3.5 transition-colors ${
                item.read ? "bg-background" : "bg-accent/5"
            } ${!isLast ? "border-b border-default-200/60" : ""}`}
        >
            {!item.read && (
                <span
                    className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r bg-accent"
                    aria-hidden
                />
            )}

            <div className="flex items-center gap-2 md:flex-col md:items-start md:gap-1 md:text-left">
                <span className="text-xs text-foreground/50 tabular-nums">
                    {formatTimeOfDay(item.createdAt)}
                </span>
                <span className="text-[11px] text-foreground/35 md:hidden">
                    {formatDate(item.createdAt)}
                </span>
            </div>

            <div className="flex min-w-0 items-center gap-3">
                <div
                    className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${tileColor}`}
                >
                    <Icon className="size-4" />
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <p
                        className={`text-sm leading-relaxed ${
                            item.read
                                ? "text-foreground/70"
                                : "text-foreground font-medium"
                        }`}
                    >
                        {notificationText(item)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-foreground/45">
                        <span className="tabular-nums">
                            {formatDate(item.createdAt)}
                        </span>
                        {!item.read && (
                            <Chip
                                size="sm"
                                variant="soft"
                                className="h-4 px-1.5 text-[10px]"
                            >
                                新
                            </Chip>
                        )}
                        {item.work && (
                            <span className="truncate hidden sm:inline">
                                · {item.work.title}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {item.work ? (
                <ChevronRight
                    className="size-4 text-foreground/30 hidden md:block shrink-0"
                    strokeWidth={1.75}
                />
            ) : (
                <span className="hidden md:block size-4 shrink-0" />
            )}
        </div>
    );
}
