import { createFileRoute } from "@tanstack/react-router";
import { SettingsPanel } from "~/components/settings/SettingsPanel";
import { PageHeader } from "~/components/ui/PageHeader";

export const Route = createFileRoute("/settings")({
    component: SettingsPage,
});

function SettingsPage() {
    return (
        <div className="mx-auto w-full max-w-3xl p-8 flex flex-col gap-6">
            <PageHeader
                title="设置"
                description="管理你的通知偏好、隐私和编辑器设置"
            />
            <SettingsPanel />
        </div>
    );
}
