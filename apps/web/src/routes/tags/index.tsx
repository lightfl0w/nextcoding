import { Button } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/components/ui/PageHeader";
import { TagCloud } from "~/components/tags/TagCloud";
import { WorksGrid } from "~/components/WorksGrid";
import { usePopularTags } from "~/hooks/usePopularTags";
import { useTagWorks } from "~/hooks/useTagWorks";

export const Route = createFileRoute("/tags/")({
    component: TagsPage,
});

function TagsPage() {
    const { tags, isLoading } = usePopularTags(100);
    const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
    const { data, isLoading: worksLoading, error } = useTagWorks(
        selectedSlug ?? undefined,
        "popular",
    );

    return (
        <div className="mx-auto w-full max-w-7xl p-8 flex flex-col gap-6">
            <PageHeader
                title="标签"
                description="点击标签，在下方查看该分类下的作品"
            />

            <TagCloud
                tags={tags}
                isLoading={isLoading}
                selectedSlug={selectedSlug}
                onSelect={setSelectedSlug}
            />

            {selectedSlug && (
                <section className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold">
                            #{data?.name ?? selectedSlug}
                        </h2>
                        <Button
                            variant="ghost"
                            size="sm"
                            onPress={() => setSelectedSlug(null)}
                        >
                            清除
                        </Button>
                    </div>
                    <WorksGrid
                        works={data?.works}
                        isLoading={worksLoading}
                        error={error}
                        placeholderCount={6}
                        emptyText="该标签下暂时没有作品"
                    />
                </section>
            )}
        </div>
    );
}
