import { Avatar, Card, Chip } from "@heroui/react";
import { Eye, Star } from "lucide-react";
import type { Work } from "~/hooks/useWorks";

export function formatCount(count: number) {
    return count >= 10000 ? `${(count / 10000).toFixed(1)}w` : String(count);
}

export function formatDate(timestamp: number) {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;

    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < minute) return "刚刚";
    if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
    if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
    if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function WorkCard({ work }: { work: Work }) {
    return (
        <Card className="w-full p-0 shadow-none rounded-2xl overflow-hidden">
            <div className="p-4 flex flex-col gap-2.5 h-full">
                <Card.Header className="gap-1">
                    <Card.Title className="text-sm">{work.title}</Card.Title>
                    <Card.Description className="text-xs leading-relaxed line-clamp-2">
                        {work.description ?? "暂无简介"}
                    </Card.Description>
                </Card.Header>

                {Array.isArray(work.tags) && work.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {work.tags.map((tag) => (
                            <Chip key={tag} size="sm" variant="soft">
                                <Chip.Label>{tag}</Chip.Label>
                            </Chip>
                        ))}
                    </div>
                )}

                <Card.Footer className="justify-between mt-auto">
                    <div className="flex items-center gap-1.5">
                        <Avatar size="sm">
                            <Avatar.Fallback>
                                {(work.author.name ?? "?")
                                    .charAt(0)
                                    .toUpperCase()}
                            </Avatar.Fallback>
                        </Avatar>
                        <span className="text-xs">
                            {work.author.name ?? "匿名"}
                        </span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-foreground/60">
                        <span
                            className="flex items-center gap-0.5"
                            title={`${work.likes} 次点赞`}
                        >
                            <Star className="size-3" />
                            {formatCount(work.likes)}
                        </span>
                        <span
                            className="flex items-center gap-0.5"
                            title={`${work.views} 次浏览`}
                        >
                            <Eye className="size-3" />
                            {formatCount(work.views)}
                        </span>
                        <span
                            className="flex items-center gap-0.5"
                            title={new Date(work.createdAt).toLocaleString()}
                        >
                            {formatDate(work.createdAt)}
                        </span>
                    </div>
                </Card.Footer>
            </div>
        </Card>
    );
}
