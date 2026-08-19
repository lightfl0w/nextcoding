import { Input, Tabs } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, Crown, Flame, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "~/components/ui/PageHeader";
import { WorksGrid } from "~/components/WorksGrid";
import { useWorks } from "~/hooks/useWorks";
import type { WorkSort } from "~/lib/api";

export const Route = createFileRoute("/discover")({
    component: DiscoverPage,
});

const DISCOVER_PAGE_SIZE = 50;
const PLACEHOLDER_COUNT = 9;

function DiscoverPage() {
    const [sort, setSort] = useState<WorkSort>("latest");
    const [keyword, setKeyword] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => setSearchTerm(keyword.trim()), 300);
        return () => clearTimeout(timer);
    }, [keyword]);

    const {
        data: works,
        isLoading,
        error,
    } = useWorks(sort, DISCOVER_PAGE_SIZE, searchTerm || undefined);

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
            <PageHeader
                title="发现作品"
                description="浏览社区里大家发布的编程作品，找到感兴趣的灵感"
            />

            <div className="flex flex-col gap-4 border-b border-default-200/70 pb-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-md">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary/60" />
                    <Input
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                        placeholder="搜索作品标题、标签、简介…"
                        aria-label="搜索作品"
                        className="w-full pl-10 pr-9"
                    />
                    {keyword && (
                        <button
                            type="button"
                            onClick={() => setKeyword("")}
                            aria-label="清除搜索"
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-foreground/40 transition-colors hover:bg-hover hover:text-foreground"
                        >
                            <X className="size-4" />
                        </button>
                    )}
                </div>

                <Tabs
                    selectedKey={sort}
                    onSelectionChange={(key) => setSort(key as WorkSort)}
                    className="w-full lg:w-auto"
                >
                    <Tabs.ListContainer className="w-full rounded-xl bg-default-100/70 p-1 lg:w-auto">
                        <Tabs.List aria-label="作品排序" className="w-full">
                            <Tabs.Tab
                                id="weekly"
                                className="flex items-center justify-center gap-1.5 text-sm"
                            >
                                <Crown className="size-4" />
                                本周热榜
                                <Tabs.Indicator />
                            </Tabs.Tab>
                            <Tabs.Tab
                                id="latest"
                                className="flex items-center justify-center gap-1.5 text-sm"
                            >
                                <Clock className="size-4" />
                                最新发布
                                <Tabs.Indicator />
                            </Tabs.Tab>
                            <Tabs.Tab
                                id="popular"
                                className="flex items-center justify-center gap-1.5 text-sm"
                            >
                                <Flame className="size-4" />
                                最受欢迎
                                <Tabs.Indicator />
                            </Tabs.Tab>
                        </Tabs.List>
                    </Tabs.ListContainer>
                </Tabs>
            </div>

            <div>
                <WorksGrid
                    works={works}
                    isLoading={isLoading}
                    error={error}
                    placeholderCount={PLACEHOLDER_COUNT}
                    emptyText={
                        searchTerm
                            ? "没有找到相关作品，换个关键词试试"
                            : undefined
                    }
                />
            </div>
        </div>
    );
}
