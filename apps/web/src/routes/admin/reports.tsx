import { Button, Card, Chip, Table, toast } from "@heroui/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Flag, X } from "lucide-react";
import { AdminPagination } from "~/components/admin/AdminPagination";
import { AdminTableShell } from "~/components/admin/AdminTableShell";
import { FilterTabs } from "~/components/admin/FilterTabs";
import { EmptyState } from "~/components/ui/EmptyState";
import { PageHeader } from "~/components/ui/PageHeader";
import { useAdminReports } from "~/hooks/useAdmin";
import {
    type AdminReport,
    type AdminReportStatus,
    dismissAdminReport,
    resolveAdminReport,
} from "~/lib/api/admin";
import { formatDate } from "~/lib/format";

const PAGE_SIZE = 20;

interface ReportsSearch {
    status?: AdminReportStatus;
    page?: number;
}

function parseSearch(search: Record<string, unknown>): ReportsSearch {
    const rawPage = Number(search.page);
    return {
        status:
            search.status === "pending" ||
            search.status === "resolved" ||
            search.status === "dismissed"
                ? search.status
                : undefined,
        page:
            Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1,
    };
}

export const Route = createFileRoute("/admin/reports")({
    validateSearch: parseSearch,
    component: ReportsPage,
});

const STATUS_LABEL: Record<AdminReportStatus, string> = {
    pending: "待处理",
    resolved: "已处理",
    dismissed: "已忽略",
};

function ReportsPage() {
    const search = Route.useSearch();
    const navigate = useNavigate({ from: "/admin/reports" });

    const { data, isLoading, mutate } = useAdminReports({
        status: search.status,
        page: search.page,
        pageSize: PAGE_SIZE,
    });

    const handleAction = async (
        report: AdminReport,
        action: "resolve" | "dismiss",
    ) => {
        try {
            if (action === "resolve") {
                await resolveAdminReport(report.id);
                toast.success("已标记为处理完成");
            } else {
                await dismissAdminReport(report.id);
                toast.success("已忽略该举报");
            }
            await mutate();
        } catch (err) {
            toast.danger((err as Error).message || "操作失败，请重试");
        }
    };

    const total = data?.total ?? 0;
    const items = data?.items ?? [];

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="举报管理"
                description="查看用户举报的作品，处理违规内容"
            />

            <Card className="p-0 shadow-none rounded-2xl border border-default-200/70">
                <Card.Content className="p-4 sm:p-5 flex flex-col gap-4">
                    <FilterTabs
                        label="按处理状态筛选"
                        value={search.status ?? "all"}
                        options={[
                            { value: "all", label: "全部" },
                            { value: "pending", label: "待处理" },
                            { value: "resolved", label: "已处理" },
                            { value: "dismissed", label: "已忽略" },
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
                        ariaLabel="举报列表"
                        columns={[
                            "作品",
                            "举报原因",
                            "举报人",
                            "状态",
                            "时间",
                            "操作",
                        ]}
                        isLoading={isLoading}
                        empty={
                            <EmptyState
                                icon={Flag}
                                title="暂无举报"
                                hint="没有符合条件的举报"
                            />
                        }
                    >
                        {items.map((report) => (
                            <Table.Row key={report.id}>
                                <Table.Cell>
                                    <Link
                                        to="/work/$id"
                                        params={{ id: report.workId }}
                                        className="text-sm text-accent hover:underline truncate max-w-[220px]"
                                    >
                                        {report.workTitle}
                                    </Link>
                                </Table.Cell>
                                <Table.Cell>
                                    <p className="text-sm text-foreground/85 line-clamp-2 max-w-[280px]">
                                        {report.reason}
                                    </p>
                                </Table.Cell>
                                <Table.Cell>
                                    <span className="text-sm text-foreground/70 truncate">
                                        {report.reporterName ?? "未知用户"}
                                    </span>
                                </Table.Cell>
                                <Table.Cell>
                                    <StatusChip status={report.status} />
                                </Table.Cell>
                                <Table.Cell>
                                    <span className="text-sm text-foreground/60">
                                        {formatDate(report.createdAt)}
                                    </span>
                                </Table.Cell>
                                <Table.Cell>
                                    {report.status === "pending" ? (
                                        <div className="flex items-center gap-1">
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="gap-1"
                                                onPress={() =>
                                                    handleAction(
                                                        report,
                                                        "resolve",
                                                    )
                                                }
                                            >
                                                <Check className="size-3.5" />
                                                处理
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="gap-1"
                                                onPress={() =>
                                                    handleAction(
                                                        report,
                                                        "dismiss",
                                                    )
                                                }
                                            >
                                                <X className="size-3.5" />
                                                忽略
                                            </Button>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-foreground/40">
                                            {report.handlerName ?? "系统"}
                                        </span>
                                    )}
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
        </div>
    );
}

function StatusChip({ status }: { status: AdminReportStatus }) {
    if (status === "pending") {
        return (
            <Chip size="sm" color="warning" variant="soft">
                <Chip.Label>{STATUS_LABEL[status]}</Chip.Label>
            </Chip>
        );
    }
    return (
        <Chip
            size="sm"
            color={status === "resolved" ? "success" : "default"}
            variant="soft"
        >
            <Chip.Label>{STATUS_LABEL[status]}</Chip.Label>
        </Chip>
    );
}
