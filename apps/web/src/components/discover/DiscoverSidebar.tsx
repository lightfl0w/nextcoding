import { Input, Tabs } from "@heroui/react";
import {
    BookOpen,
    Clock,
    Crown,
    Flame,
    Search,
    Sparkles,
    X,
} from "lucide-react";
import type { WorkSort } from "~/lib/api";

export type DiscoverView = "works" | "novels";

interface DiscoverSidebarProps {
    view: DiscoverView;
    onViewChange: (view: DiscoverView) => void;
    sort: WorkSort;
    onSortChange: (sort: WorkSort) => void;
    keyword: string;
    onKeywordChange: (keyword: string) => void;
}

/**
 * 发现页侧栏：搜索、排序与内容类型切换。
 * 作为布局的一部分常驻显示，作品 / 小说视图共用。
 */
export function DiscoverSidebar({
    view,
    onViewChange,
    sort,
    onSortChange,
    keyword,
    onKeywordChange,
}: DiscoverSidebarProps) {
    return (
        <aside className="flex w-full flex-col gap-6 lg:sticky lg:top-20 lg:w-64 lg:shrink-0">
            <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground/80">
                    搜索
                </span>
                <div className="relative w-full">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary/60" />
                    <Input
                        value={keyword}
                        onChange={(event) =>
                            onKeywordChange(event.target.value)
                        }
                        placeholder="搜索标题、简介…"
                        aria-label="搜索内容"
                        className="w-full pl-10 pr-9"
                    />
                    {keyword && (
                        <button
                            type="button"
                            onClick={() => onKeywordChange("")}
                            aria-label="清除搜索"
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-foreground/40 transition-colors hover:bg-hover hover:text-foreground"
                        >
                            <X className="size-4" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground/80">
                    排序
                </span>
                <Tabs
                    selectedKey={sort}
                    onSelectionChange={(key) => onSortChange(key as WorkSort)}
                    orientation="vertical"
                    className="w-full"
                >
                    <Tabs.ListContainer className="w-full bg-default-100/70 p-1">
                        <Tabs.List
                            aria-label="内容排序"
                            className="flex w-full flex-col gap-1"
                        >
                            <Tabs.Tab
                                id="weekly"
                                className="flex w-full items-center justify-start gap-2 px-3 py-2 text-sm data-[selected=true]:bg-surface data-[selected=true]:text-primary data-[selected=true]:shadow-sm"
                            >
                                <Crown className="size-4" />
                                本周热榜
                                <Tabs.Indicator />
                            </Tabs.Tab>
                            <Tabs.Tab
                                id="latest"
                                className="flex w-full items-center justify-start gap-2 px-3 py-2 text-sm data-[selected=true]:bg-surface data-[selected=true]:text-primary data-[selected=true]:shadow-sm"
                            >
                                <Clock className="size-4" />
                                最新发布
                                <Tabs.Indicator />
                            </Tabs.Tab>
                            <Tabs.Tab
                                id="popular"
                                className="flex w-full items-center justify-start gap-2 px-3 py-2 text-sm data-[selected=true]:bg-surface data-[selected=true]:text-primary data-[selected=true]:shadow-sm"
                            >
                                <Flame className="size-4" />
                                最受欢迎
                                <Tabs.Indicator />
                            </Tabs.Tab>
                        </Tabs.List>
                    </Tabs.ListContainer>
                </Tabs>
            </div>

            <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground/80">
                    内容类型
                </span>

                <Tabs
                    selectedKey={view}
                    onSelectionChange={(key) =>
                        onViewChange(key as DiscoverView)
                    }
                    orientation="vertical"
                    className="w-full"
                >
                    <Tabs.ListContainer className="w-full bg-default-100/70 p-1">
                        <Tabs.List
                            aria-label="发现内容类型"
                            className="flex w-full gap-1"
                        >
                            <Tabs.Tab
                                id="works"
                                className="flex items-center justify-center gap-2 px-4 py-2 text-sm data-[selected=true]:bg-surface data-[selected=true]:text-primary data-[selected=true]:shadow-sm"
                            >
                                <Sparkles className="size-4" />
                                作品
                                <Tabs.Indicator />
                            </Tabs.Tab>
                            <Tabs.Tab
                                id="novels"
                                className="flex items-center justify-center gap-2 px-4 py-2 text-sm data-[selected=true]:bg-surface data-[selected=true]:text-primary data-[selected=true]:shadow-sm"
                            >
                                <BookOpen className="size-4" />
                                小说
                                <Tabs.Indicator />
                            </Tabs.Tab>
                        </Tabs.List>
                    </Tabs.ListContainer>
                </Tabs>
            </div>
        </aside>
    );
}
