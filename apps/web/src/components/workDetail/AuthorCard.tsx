import { Avatar, Button, Card } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import type { Author } from "~/lib/api";

const ANONYMOUS_NAME = "匿名";

interface AuthorCardProps {
    author: Author;
    isSelf: boolean;
    isPending: boolean;
    onToggleFollow: () => void;
}

/**
 * 作者卡片。
 * @param props.author - 作品作者信息。
 * @param props.isSelf - 当前用户是否为作者本人。
 * @param props.isPending - 关注请求进行中。
 * @param props.onToggleFollow - 切换关注状态。
 * @remarks 展示头像、昵称、粉丝数与简介；支持关注/取消关注。
 */
export function AuthorCard({
    author,
    isSelf,
    isPending,
    onToggleFollow,
}: AuthorCardProps) {
    const name = author.name ?? ANONYMOUS_NAME;
    const initial = name.charAt(0).toUpperCase();
    const followers = author.followers ?? 0;
    const followedByMe = author.followedByMe ?? false;

    return (
        <Card className="p-0 shadow-none rounded-2xl border border-default-200/70">
            <Card.Content className="p-5 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <Avatar size="lg">
                        {author.image ? (
                            <Avatar.Image alt={name} src={author.image} />
                        ) : null}
                        <Avatar.Fallback>{initial}</Avatar.Fallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0 gap-0.5 flex-1">
                        {author.id ? (
                            <Link
                                to="/user/$id"
                                params={{ id: author.id }}
                                className="text-base font-semibold truncate hover:text-primary transition-colors"
                            >
                                {name}
                            </Link>
                        ) : (
                            <span className="text-base font-semibold truncate">
                                {name}
                            </span>
                        )}
                        <span className="text-xs text-foreground/50">
                            {followers} 粉丝
                        </span>
                    </div>
                    <Button
                        size="sm"
                        variant={followedByMe ? "secondary" : "primary"}
                        isDisabled={isSelf || isPending}
                        onPress={onToggleFollow}
                        className="gap-1.5 shrink-0"
                    >
                        {followedByMe ? "已关注" : "关注"}
                    </Button>
                </div>
                {author.bio ? (
                    <p className="text-sm text-foreground/70 leading-relaxed whitespace-pre-wrap">
                        {author.bio}
                    </p>
                ) : (
                    <p className="text-sm text-foreground/40">
                        TA 还没有填写简介
                    </p>
                )}
            </Card.Content>
        </Card>
    );
}
