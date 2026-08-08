import { Avatar, Card, Chip } from "@heroui/react";
import {
    BarChart3,
    Braces,
    Cpu,
    Database,
    Eye,
    Globe,
    type LucideIcon,
    Palette,
    Star,
} from "lucide-react";

type FeaturedWork = {
    id: string;
    title: string;
    description: string;
    author: string;
    tags: string[];
    stars: number;
    views: number;
    icon: LucideIcon;
    gradient: string;
};

const featuredWorks: FeaturedWork[] = [
    {
        id: "nitian-os",
        title: "nitian-os",
        description:
            "从零实现的操作系统内核：引导、内存管理、多线程、系统调用与交互式 Shell。",
        author: "nitian",
        tags: ["操作系统", "C", "汇编"],
        stars: 328,
        views: 12400,
        icon: Cpu,
        gradient: "linear-gradient(135deg, #6366f1, #a855f7)",
    },
    {
        id: "neosql",
        title: "NeoSQL",
        description:
            "用 Rust 编写的迷你关系型数据库，支持 SQL 解析、B+ 树索引与事务。",
        author: "luna",
        tags: ["Rust", "数据库"],
        stars: 256,
        views: 8900,
        icon: Database,
        gradient: "linear-gradient(135deg, #0ea5e9, #22d3ee)",
    },
    {
        id: "webforge",
        title: "WebForge",
        description:
            "零依赖实现的轻量 HTTP 服务器，支持静态文件、路由与中间件。",
        author: "kevin",
        tags: ["Go", "网络"],
        stars: 198,
        views: 7200,
        icon: Globe,
        gradient: "linear-gradient(135deg, #f59e0b, #ef4444)",
    },
    {
        id: "minilang",
        title: "MiniLang",
        description:
            "TypeScript 实现的脚本语言解释器，含词法分析、语法树与求值器。",
        author: "akira",
        tags: ["TypeScript", "编译器"],
        stars: 175,
        views: 6300,
        icon: Braces,
        gradient: "linear-gradient(135deg, #10b981, #84cc16)",
    },
    {
        id: "pixelcraft",
        title: "PixelCraft",
        description:
            "基于 Canvas 的像素画编辑器，支持图层、调色板与 GIF 导出。",
        author: "mei",
        tags: ["React", "Canvas"],
        stars: 143,
        views: 5100,
        icon: Palette,
        gradient: "linear-gradient(135deg, #ec4899, #8b5cf6)",
    },
    {
        id: "sortviz",
        title: "SortViz",
        description:
            "排序算法可视化工具，实时展示 12 种排序算法的执行过程与比较次数。",
        author: "brian",
        tags: ["Vue", "动画"],
        stars: 121,
        views: 4600,
        icon: BarChart3,
        gradient: "linear-gradient(135deg, #14b8a6, #0ea5e9)",
    },
];

function formatCount(count: number) {
    return count >= 10000 ? `${(count / 10000).toFixed(1)}w` : String(count);
}

export function FeaturedWorks() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {featuredWorks.map((work) => (
                <WorkCard key={work.id} work={work} />
            ))}
        </div>
    );
}

function WorkCard({ work }: { work: FeaturedWork }) {
    return (
        <Card className="w-full p-0 shadow-none rounded-2xl overflow-hidden">
            <div className="p-4 flex flex-col gap-2.5">
                <Card.Header className="gap-1">
                    <Card.Title className="text-sm">{work.title}</Card.Title>
                    <Card.Description className="text-xs leading-relaxed line-clamp-2">
                        {work.description}
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
                                {work.author[0].toUpperCase()}
                            </Avatar.Fallback>
                        </Avatar>
                        <span className="text-xs">{work.author}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-foreground/60">
                        <span className="flex items-center gap-0.5">
                            <Star className="size-3" />
                            {formatCount(work.stars)}
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
