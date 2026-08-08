import { Avatar, Card, Chip, Skeleton } from "@heroui/react";
import { Eye, Star } from "lucide-react";
import { useWorks, type Work } from "~/hooks/useWorks";

function formatCount(count: number) {
    return count >= 10000 ? `${(count / 10000).toFixed(1)}w` : String(count);
}

export function FeaturedWorks() {
    const { data: works, isLoading, error } = useWorks();

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="flex flex-col gap-2">
                        <Skeleton className="h-32 rounded-2xl" />
                        <Skeleton className="h-4 w-2/3 rounded-md" />
                        <Skeleton className="h-3 w-full rounded-md" />
                        <Skeleton className="h-3 w-1/2 rounded-md" />
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <p className="text-sm text-foreground/60">
                作品加载失败，请稍后重试
            </p>
        );
    }

    if (!works?.length) {
        return (
            <p className="text-sm text-foreground/60">
                还没有作品，来发布第一个吧
            </p>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {works.map((work) => (
                <WorkCard key={work.id} work={work} />
            ))}
        </div>
    );
}

function WorkCard({ work }: { work: Work }) {
    return (
        <Card className="w-full p-0 shadow-none rounded-2xl overflow-hidden">
            <div className="p-4 flex flex-col gap-2.5">
                <Card.Header className="gap-1">
                    <Card.Title className="text-sm">{work.title}</Card.Title>
                    <Card.Description className="text-xs leading-relaxed line-clamp-2">
                        {work.description ?? "暂无简介"}
                    </Card.Description>
                </Card.Header>

                <div className="flex flex-wrap gap-1">
                    {work.tags.map((tag) => (
                        <Chip key={tag} size="sm" variant="soft">
                            <Chip.Label>{tag}</Chip.Label>
                        </Chip>
                    ))}
                </div>

                <Card.Footer className="justify-between">
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
                        <span className="flex items-center gap-0.5">
                            <Star className="size-3" />
                            {formatCount(work.likes)}
                        </span>
                        <span className="flex items-center gap-0.5">
                            <Eye className="size-3" />
                            {formatCount(work.views)}
                        </span>
                    </div>
                </Card.Footer>
            </div>
        </Card>
    );
}
