import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/templates")({
    component: TemplatesLayout,
});

/**
 * 模板模块布局：模板市场 / 创建模板 / 模板详情 共用。
 */
function TemplatesLayout() {
    return <Outlet />;
}
