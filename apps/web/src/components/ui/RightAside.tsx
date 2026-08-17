import { Card } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { Flame, Info, Sparkles } from "lucide-react";
import { useWorks } from "~/hooks/useWorks";
import { formatCount } from "~/lib/format";

const HOT_LIMIT = 5;

/**
 * 右侧信息栏：热门作品与站点入口，仅在 xl+ 宽屏显示。
 */
export function RightAside() {
    const { data: works } = useWorks("popular", HOT_LIMIT);

    return (
        <aside className="hidden xl:flex flex-col gap-4 w-60 shrink-0 py-8 pr-8 pl-2 sticky top-0 self-start">
            <Card className="p-0 shadow-none rounded-2xl border border-default-200/70">
                <Card.Header className="px-3 pt-3 pb-1">
                    <Card.Title className="text-sm font-bold flex items-center gap-2">
                        <Flame className="size-4 text-foreground/55" />
                        热门作品
                    </Card.Title>
                </Card.Header>
                <Card.Content className="flex flex-col gap-1 px-2 pb-2">
                    {works?.map((work, index) => (
                        <Link
                            key={work.id}
                            to="/work/$id"
                            params={{ id: work.id }}
                            className="flex items-center gap-2 px-1.5 py-1.5 rounded-lg hover:bg-hover transition-colors min-w-0"
                        >
                            <span className="text-xs font-semibold text-foreground/35 w-4 shrink-0 tabular-nums">
                                {index + 1}
                            </span>
                            <span className="flex-1 truncate text-sm">
                                {work.title}
                            </span>
                            <span className="flex items-center gap-0.5 text-xs text-foreground/45 shrink-0 tabular-nums">
                                <Sparkles className="size-3" />
                                {formatCount(work.sparks)}
                            </span>
                        </Link>
                    ))}
                </Card.Content>
            </Card>

            <Link
                to="/about"
                className="flex items-center gap-1.5 text-xs text-foreground/40 hover:text-foreground/70 transition-colors px-1"
            >
                <Info className="size-3.5" />
                关于 NextCoding
            </Link>
        </aside>
    );
}
