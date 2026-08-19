import {
    Button,
    Card,
    Chip,
    Table,
    toast,
    useOverlayState,
} from "@heroui/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, LayoutTemplate, Trash2, X } from "lucide-react";
import { useState } from "react";
import { AdminPagination } from "~/components/admin/AdminPagination";
import { AdminTableShell } from "~/components/admin/AdminTableShell";
import { FilterTabs } from "~/components/admin/FilterTabs";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { EmptyState } from "~/components/ui/EmptyState";
import { PageHeader } from "~/components/ui/PageHeader";
import { useAdminTemplates } from "~/hooks/useAdmin";
import {
    type AdminTemplate,
    type AdminTemplateStatus,
    approveAdminTemplate,
    deleteAdminTemplate,
    rejectAdminTemplate,
} from "~/lib/api/admin";
import { formatDate } from "~/lib/format";
import { templateCategoryLabel } from "~/lib/templateCategories";

const PAGE_SIZE = 20;

interface TemplatesSearch {
    status?: AdminTemplateStatus;
    page?: number;
}

function parseSearch(search: Record<string, unknown>): TemplatesSearch {
    const rawPage = Number(search.page);
    return {
        status:
            search.status === "pending" ||
            search.status === "published" ||
            search.status === "rejected"
                ? search.status
                : undefined,
        page:
            Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1,
    };
}

export const Route = createFileRoute("/admin/templates")({
    validateSearch: parseSearch,
    component: TemplatesPage,
});

const STATUS_LABEL: Record<AdminTemplateStatus, string> = {
    pending: "待审核",
    published: "已上架",
    rejected: "已驳回",
};

function TemplatesPage() {
    const search = Route.useSearch();
    const navigate = useNavigate({ from: "/admin/templates" });

    const [deleteTarget, setDeleteTarget] = useState<AdminTemplate | null>(
        null,
    );
    const deleteState = useOverlayState();

    const { data, isLoading, mutate } = useAdminTemplates({
        status: search.status,
        page: search.page,
        pageSize: PAGE_SIZE,
    });

    const handleAction = async (
        template: AdminTemplate,
        action: "approve" | "reject",
    ) => {
        try {
            if (action === "approve") {
                await approveAdminTemplate(template.id);
                toast.success("模板已通过，已上架模板市场");
            } else {
                await rejectAdminTemplate(template.id);
                toast.success("模板已驳回");
            }
            await mutate();
        } catch (err) {
            toast.danger((err as Error).message || "操作失败，请重试");
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) {
            return;
        }
        try {
            await deleteAdminTemplate(deleteTarget.id);
            toast.success("模板已删除");
            await mutate();
        } catch (err) {
            toast.danger((err as Error).message || "删除失败，请重试");
        }
    };

    const total = data?.total ?? 0;
    const items = data?.items ?? [];

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="模板管理"
                description="审核用户提交的模板，通过后上架模板市场"
            />

            <Card className="p-0 shadow-none rounded-2xl border border-default-200/70">
                <Card.Content className="p-4 sm:p-5 flex flex-col gap-4">
                    <FilterTabs
                        label="按审核状态筛选"
                        value={search.status ?? "all"}
                        options={[
                            { value: "all", label: "全部" },
                            { value: "pending", label: "待审核" },
                            { value: "published", label: "已上架" },
                            { value: "rejected", label: "已驳回" },
                        ]}
                        onChange={(status) =>
                            navigate({
                                search: (prev) => ({
                                    ...prev,
                                    status:
                                        status === "all" ? undefined : status,
                                    page: undefined,
                                }),
                                replace: true,
                            })
                        }
                    />

                    <AdminTableShell
                        ariaLabel="模板列表"
                        columns={[
                            "模板",
                            "作者",
                            "分类",
                            "文件数",
                            "提交时间",
                            "状态",
                            "操作",
                        ]}
                        isLoading={isLoading}
                        empty={
                            <EmptyState
                                icon={LayoutTemplate}
                                title="暂无模板"
                                hint="没有符合条件的模板"
                            />
                        }
                    >
                        {items.map((template) => (
                            <Table.Row key={template.id}>
                                <Table.Cell>
                                    <Link
                                        to="/templates/$id"
                                        params={{ id: template.id }}
                                        className="text-sm text-accent hover:underline truncate max-w-[220px]"
                                    >
                                        {template.title}
                                    </Link>
                                </Table.Cell>
                                <Table.Cell>
                                    <span className="text-sm text-foreground/70 truncate">
                                        {template.authorName ?? "官方模板"}
                                    </span>
                                </Table.Cell>
                                <Table.Cell>
                                    <span className="text-sm text-foreground/70">
                                        {template.category
                                            ? templateCategoryLabel(
                                                  template.category,
                                              )
                                            : "未分类"}
                                    </span>
                                </Table.Cell>
                                <Table.Cell>
                                    <span className="text-sm text-foreground/70 tabular-nums">
                                        {template.fileCount}
                                    </span>
                                </Table.Cell>
                                <Table.Cell>
                                    <span className="text-sm text-foreground/60">
                                        {formatDate(template.createdAt)}
                                    </span>
                                </Table.Cell>
                                <Table.Cell>
                                    <StatusChip status={template.status} />
                                </Table.Cell>
                                <Table.Cell>
                                    <div className="flex items-center gap-1">
                                        {template.status === "pending" && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="gap-1"
                                                    onPress={() =>
                                                        handleAction(
                                                            template,
                                                            "approve",
                                                        )
                                                    }
                                                >
                                                    <Check className="size-3.5" />
                                                    通过
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="gap-1"
                                                    onPress={() =>
                                                        handleAction(
                                                            template,
                                                            "reject",
                                                        )
                                                    }
                                                >
                                                    <X className="size-3.5" />
                                                    驳回
                                                </Button>
                                            </>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="gap-1 text-danger"
                                            onPress={() => {
                                                setDeleteTarget(template);
                                                deleteState.open();
                                            }}
                                        >
                                            <Trash2 className="size-3.5" />
                                            删除
                                        </Button>
                                    </div>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </AdminTableShell>

                    <AdminPagination
                        page={search.page ?? 1}
                        pageSize={PAGE_SIZE}
                        total={total}
                        onPageChange={(page) =>
                            navigate({
                                search: (prev) => ({ ...prev, page }),
                                replace: true,
                            })
                        }
                    />
                </Card.Content>
            </Card>

            <ConfirmDialog
                state={deleteState}
                heading="删除模板"
                description={
                    deleteTarget
                        ? `确定删除模板「${deleteTarget.title}」吗？其快照文件与使用记录将一并删除，此操作不可恢复。`
                        : ""
                }
                confirmLabel="删除模板"
                onConfirm={handleDelete}
            />
        </div>
    );
}

function StatusChip({ status }: { status: AdminTemplateStatus }) {
    const color =
        status === "pending"
            ? "warning"
            : status === "published"
              ? "success"
              : "danger";
    return (
        <Chip size="sm" color={color} variant="soft">
            <Chip.Label>{STATUS_LABEL[status]}</Chip.Label>
        </Chip>
    );
}
