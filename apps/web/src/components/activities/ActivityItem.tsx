import { Avatar } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import {
    FileText,
    GitFork,
    LayoutTemplate,
    MessageCircle,
    Sparkles,
    UserPlus,
} from "lucide-react";
import { memo } from "react";
import type { Activity } from "~/lib/api";
import { formatDate } from "~/lib/format";

/**
 * 单条动态，根据类型展示不同图标和文案。
 * @param props.activity - 动态数据。
 */
export const ActivityItem = memo(function ActivityItem({
    activity,
}: {
    activity: Activity;
}) {
    const { type, actor, work, targetUser, comment, createdAt } = activity;

    const iconMap = {
        spark: Sparkles,
        remix: GitFork,
        comment: MessageCircle,
        publish: FileText,
        follow: UserPlus,
        template: LayoutTemplate,
    } as const;

    const Icon = iconMap[type];

    return (
        <div className="flex gap-3 py-3">
            <Link
                to="/user/$id"
                params={{ id: actor?.id ?? "" }}
                className="shrink-0"
            >
                <Avatar size="sm">
                    <Avatar.Fallback>
                        {(actor?.name ?? "?").charAt(0).toUpperCase()}
                    </Avatar.Fallback>
                </Avatar>
            </Link>

            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                    <Icon className="size-3.5 text-foreground/50 shrink-0" />
                    <Link
                        to="/user/$id"
                        params={{ id: actor?.id ?? "" }}
                        className="font-medium truncate hover:underline"
                    >
                        {actor?.name ?? "匿名用户"}
                    </Link>
                    <span className="text-foreground/60 truncate">
                        {type === "spark" && work && (
                            <>
                                给 <WorkLink work={work} /> 送了一个火花
                            </>
                        )}
                        {type === "remix" && work && (
                            <>
                                复刻了 <WorkLink work={work} />
                            </>
                        )}
                        {type === "comment" && work && (
                            <>
                                评论了 <WorkLink work={work} />
                                {comment?.content && (
                                    <>: {comment.content.slice(0, 50)}</>
                                )}
                            </>
                        )}
                        {type === "publish" && work && (
                            <>
                                发布了新作品 <WorkLink work={work} />
                            </>
                        )}
                        {type === "template" && work && (
                            <>
                                发布了新模板 <WorkLink work={work} />
                                ，快来使用吧
                            </>
                        )}
                        {type === "follow" && targetUser && (
                            <>
                                关注了{" "}
                                <UserLink
                                    id={targetUser.id}
                                    name={targetUser.name}
                                />
                            </>
                        )}
                    </span>
                </div>
                <span className="text-xs text-foreground/40 pl-5.5">
                    {formatDate(createdAt)}
                </span>
            </div>
        </div>
    );
});

function WorkLink({ work }: { work: { id: string; title: string } }) {
    return (
        <Link
            to="/work/$id"
            params={{ id: work.id }}
            className="font-medium hover:underline"
        >
            {work.title}
        </Link>
    );
}

function UserLink({ id, name }: { id: string; name?: string | null }) {
    return (
        <Link
            to="/user/$id"
            params={{ id }}
            className="font-medium hover:underline"
        >
            {name ?? "匿名用户"}
        </Link>
    );
}
