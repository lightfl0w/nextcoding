import { Button, Card } from "@heroui/react";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { AdminNav } from "~/components/admin/AdminNav";
import { AdminSidebar } from "~/components/admin/AdminSidebar";
import { LoadingState } from "~/components/ui/LoadingState";
import { useAuth } from "~/hooks/useAuth";

export const Route = createFileRoute("/admin")({
    component: AdminLayout,
});

function AdminLayout() {
    const { user, isLoggedIn, isPending } = useAuth();

    if (isPending) {
        return (
            <AdminShell>
                <LoadingState text="正在验证身份…" />
            </AdminShell>
        );
    }

    if (!isLoggedIn || !user) {
        return (
            <AdminShell>
                <GuardCard
                    icon={ShieldCheck}
                    title="请先登录"
                    hint="管理后台仅对登录用户开放"
                    action={
                        <Link
                            to="/auth"
                            search={{ mode: "login", redirect: undefined }}
                        >
                            <Button variant="primary">去登录</Button>
                        </Link>
                    }
                />
            </AdminShell>
        );
    }

    if (user.role !== "admin") {
        return (
            <AdminShell>
                <GuardCard
                    icon={ShieldAlert}
                    title="无权访问"
                    hint="管理后台需要管理员权限"
                />
            </AdminShell>
        );
    }

    return (
        <div className="flex min-h-screen">
            <AdminSidebar />
            <div className="flex-1 min-w-0">
                <AdminNav className="px-6 pt-6 md:hidden" />
                <div className="mx-auto w-full max-w-7xl p-6 sm:p-8">
                    <Outlet />
                </div>
            </div>
        </div>
    );
}

function AdminShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="mx-auto w-full max-w-7xl p-6 sm:p-8 flex flex-col gap-6">
            {children}
        </div>
    );
}

function GuardCard({
    icon: Icon,
    title,
    hint,
    action,
}: {
    icon: typeof ShieldAlert;
    title: string;
    hint: string;
    action?: React.ReactNode;
}) {
    return (
        <Card className="p-0 shadow-none rounded-2xl border border-default-200/70">
            <Card.Content className="py-20 flex flex-col items-center gap-3 text-foreground/50">
                <div className="size-14 rounded-full bg-default-100/80 flex items-center justify-center">
                    <Icon className="size-7" strokeWidth={1.5} />
                </div>
                <p className="text-base font-semibold text-foreground/75">
                    {title}
                </p>
                <p className="text-sm text-foreground/45">{hint}</p>
                {action && <div className="mt-2">{action}</div>}
            </Card.Content>
        </Card>
    );
}
