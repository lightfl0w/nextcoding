import { createFileRoute } from "@tanstack/react-router";

import { WorkEditor } from "~/components/workEditor/WorkEditor";

export const Route = createFileRoute("/work/new/edit")({
    component: WorkNewEditRoute,
});

/**
 * 新建作品编辑器（待创建模式）。
 * 作品尚未在服务器创建，点「保存草稿」或「发布」时才真正创建。
 */
function WorkNewEditRoute() {
    return <WorkEditor workId={null} />;
}
