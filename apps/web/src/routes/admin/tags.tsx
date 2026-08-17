import { Card, useOverlayState } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { TagsTable } from "~/components/admin/TagsTable";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { PageHeader } from "~/components/ui/PageHeader";
import { useAdminTags } from "~/hooks/useAdmin";
import { type AdminTag, deleteAdminTag } from "~/lib/api/admin";

export const Route = createFileRoute("/admin/tags")({
    component: TagsPage,
});

function TagsPage() {
    const { data: items, isLoading, mutate } = useAdminTags();
    const [deleteTarget, setDeleteTarget] = useState<AdminTag | null>(null);
    const deleteState = useOverlayState();

    const handleDelete = async () => {
        if (!deleteTarget) {
            return;
        }
        await deleteAdminTag(deleteTarget.id);
        await mutate();
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="标签管理"
                description="查看标签热度，清理无效分类"
            />

            <Card className="p-0 shadow-none rounded-2xl border border-default-200/70">
                <Card.Content className="p-4 sm:p-5">
                    <TagsTable
                        items={items ?? []}
                        isLoading={isLoading}
                        onRequestDelete={(tag) => {
                            setDeleteTarget(tag);
                            deleteState.open();
                        }}
                    />
                </Card.Content>
            </Card>

            <ConfirmDialog
                state={deleteState}
                heading="删除标签"
                description={
                    deleteTarget
                        ? `确定删除标签「${deleteTarget.name}」吗？该标签与作品的关联将一并移除，此操作不可恢复。`
                        : ""
                }
                confirmLabel="删除标签"
                onConfirm={handleDelete}
            />
        </div>
    );
}
