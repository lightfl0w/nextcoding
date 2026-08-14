import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/components/ui/PageHeader";
import { WorksGrid } from "~/components/WorksGrid";
import { useTagWorks } from "~/hooks/useTagWorks";
import type { WorkSort } from "~/lib/api";

export const Route = createFileRoute("/tags/$slug")({
    component: TagDetailPage,
});

function TagDetailPage() {
    const { slug } = useParams({ from: "/tags/$slug" });
    const [sort] = useState<WorkSort>("popular");
    const { data, isLoading, error } = useTagWorks(slug, sort);

    return (
        <div className="mx-auto w-full max-w-7xl p-8 flex flex-col gap-6">
            <PageHeader
                title={`#${data?.name ?? slug}`}
                description={data?.description ?? `浏览标签 "${slug}" 下的作品`}
            />
            <WorksGrid
                works={data?.works}
                isLoading={isLoading}
                error={error}
                placeholderCount={6}
                emptyText="该标签下暂时没有作品"
            />
        </div>
    );
}
