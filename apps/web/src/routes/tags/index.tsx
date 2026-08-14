import { createFileRoute } from "@tanstack/react-router";
import { TagCloud } from "~/components/tags/TagCloud";
import { PageHeader } from "~/components/ui/PageHeader";
import { usePopularTags } from "~/hooks/usePopularTags";

export const Route = createFileRoute("/tags/")({
    component: TagsPage,
});

function TagsPage() {
    const { tags, isLoading } = usePopularTags(100);

    return (
        <div className="mx-auto w-full max-w-7xl p-8 flex flex-col gap-6">
            <PageHeader
                title="标签"
                description="通过标签发现感兴趣的作品分类"
            />
            <TagCloud tags={tags} isLoading={isLoading} />
        </div>
    );
}
