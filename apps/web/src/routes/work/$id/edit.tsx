import { createFileRoute, useParams } from "@tanstack/react-router";

import { WorkEditor } from "~/components/workEditor/WorkEditor";

export const Route = createFileRoute("/work/$id/edit")({
    component: WorkEditRoute,
});

function WorkEditRoute() {
    const { id: workId } = useParams({ from: "/work/$id/edit" });
    return <WorkEditor workId={workId} />;
}
