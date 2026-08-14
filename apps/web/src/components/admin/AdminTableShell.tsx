import { Skeleton, Spinner, Table } from "@heroui/react";
import type { ReactNode } from "react";

interface AdminTableShellProps {
    ariaLabel: string;
    columns: string[];
    isLoading: boolean;
    empty: ReactNode;
    children: ReactNode;
}

/**
 * 管理表格外壳：统一列头、加载骨架与空状态，行内容由调用方提供。
 */
export function AdminTableShell({
    ariaLabel,
    columns,
    isLoading,
    empty,
    children,
}: AdminTableShellProps) {
    if (isLoading) {
        return <AdminTableSkeleton rows={4} />;
    }
    if (
        children === null ||
        (Array.isArray(children) && children.length === 0)
    ) {
        return <>{empty}</>;
    }

    return (
        <Table variant="secondary">
            <Table.ScrollContainer>
                <Table.Content aria-label={ariaLabel} className="min-w-[760px]">
                    <Table.Header>
                        {columns.map((column, index) => (
                            <Table.Column
                                key={column}
                                isRowHeader={index === 0}
                            >
                                {column}
                            </Table.Column>
                        ))}
                    </Table.Header>
                    <Table.Body>{children}</Table.Body>
                </Table.Content>
            </Table.ScrollContainer>
        </Table>
    );
}

const SKELETON_IDS = ["s1", "s2", "s3", "s4"];

function AdminTableSkeleton({ rows }: { rows: number }) {
    return (
        <div className="flex flex-col gap-3">
            {SKELETON_IDS.slice(0, rows).map((id) => (
                <div
                    key={id}
                    className="h-14 rounded-xl border border-default-200/60 flex items-center gap-4 px-4"
                >
                    <Skeleton className="size-8 rounded-full" />
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                        <Skeleton className="h-3 w-1/3 rounded" />
                        <Skeleton className="h-3 w-1/5 rounded" />
                    </div>
                    <Skeleton className="h-8 w-24 rounded-lg" />
                </div>
            ))}
            <div className="flex items-center justify-center gap-2 text-foreground/40 py-2">
                <Spinner size="sm" />
                <span className="text-xs">正在加载…</span>
            </div>
        </div>
    );
}
