import { Avatar, Card, Skeleton } from "@heroui/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
    Eye,
    FileCode2,
    MessageSquareQuote,
    Sparkles,
    Tags,
    Users,
} from "lucide-react";
import { StatCard } from "~/components/admin/StatCard";
import { TrendChart } from "~/components/admin/TrendChart";
import { AlertBox } from "~/components/ui/AlertBox";
import { PageHeader } from "~/components/ui/PageHeader";
import { useAdminStats } from "~/hooks/useAdmin";
import { formatCount, formatDate } from "~/lib/format";

export const Route = createFileRoute("/admin/")({
    component: AdminDashboardPage,
});

function AdminDashboardPage() {
    const { data: stats, isLoading, error } = useAdminStats();

    if (isLoading) {
        return <DashboardSkeleton />;
    }
    if (error || !stats) {
        return (
            <div className="py-20">
                <AlertBox
                    status="danger"
                    title="加载失败"
                    message="统计加载失败，请稍后刷新重试"
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="仪表盘" description="平台整体运营数据一览" />

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                <StatCard
                    icon={Users}
                    label="注册用户"
                    value={stats.users}
                    hint={`已发布作品 ${stats.publishedWorks.toLocaleString()} 个`}
                />
                <StatCard
                    icon={FileCode2}
                    label="作品总数"
                    value={stats.works}
                    hint={`草稿 ${Math.max(stats.works - stats.publishedWorks, 0).toLocaleString()} 个`}
                />
                <StatCard
                    icon={Sparkles}
                    label="火花总数"
                    value={stats.sparks}
                />
                <StatCard
                    icon={MessageSquareQuote}
                    label="评论总数"
                    value={stats.comments}
                />
                <StatCard icon={Tags} label="标签总数" value={stats.tags} />
                <StatCard icon={Eye} label="总浏览量" value={stats.views} />
            </div>

            <Card className="p-0 shadow-none rounded-2xl border border-default-200/70">
                <Card.Content className="p-5 flex flex-col gap-4">
                    <h2 className="text-sm font-semibold text-foreground/80">
                        近 7 天新增
                    </h2>
                    <TrendChart trend={stats.trend} />
                </Card.Content>
            </Card>

            <div className="grid lg:grid-cols-2 gap-4">
                <Card className="p-0 shadow-none rounded-2xl border border-default-200/70">
                    <Card.Content className="p-5 flex flex-col gap-3">
                        <h2 className="text-sm font-semibold text-foreground/80">
                            最新注册用户
                        </h2>
                        {stats.recentUsers.length === 0 ? (
                            <p className="text-sm text-foreground/40 py-6 text-center">
                                暂无用户
                            </p>
                        ) : (
                            <ul className="flex flex-col divide-y divide-default-100">
                                {stats.recentUsers.map((user) => (
                                    <li key={user.id}>
                                        <Link
                                            to="/user/$id"
                                            params={{ id: user.id }}
                                            className="flex items-center gap-3 py-2.5 rounded-lg hover:bg-hover transition-colors"
                                        >
                                            <Avatar
                                                size="sm"
                                                className="shrink-0"
                                            >
                                                {user.image ? (
                                                    <Avatar.Image
                                                        alt={
                                                            user.name ?? "用户"
                                                        }
                                                        src={user.image}
                                                    />
                                                ) : null}
                                                <Avatar.Fallback>
                                                    {(user.name ?? "用")
                                                        .trim()
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </Avatar.Fallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">
                                                    {user.name ?? "未命名用户"}
                                                </p>
                                                <p className="text-xs text-foreground/45 truncate">
                                                    {user.email}
                                                </p>
                                            </div>
                                            <span className="text-xs text-foreground/40 shrink-0">
                                                {formatDate(user.createdAt)}
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card.Content>
                </Card>

                <Card className="p-0 shadow-none rounded-2xl border border-default-200/70">
                    <Card.Content className="p-5 flex flex-col gap-3">
                        <h2 className="text-sm font-semibold text-foreground/80">
                            热门作品
                        </h2>
                        {stats.topWorks.length === 0 ? (
                            <p className="text-sm text-foreground/40 py-6 text-center">
                                暂无作品
                            </p>
                        ) : (
                            <ul className="flex flex-col divide-y divide-default-100">
                                {stats.topWorks.map((work) => (
                                    <li key={work.id}>
                                        <Link
                                            to="/work/$id"
                                            params={{ id: work.id }}
                                            className="flex items-center gap-3 py-2.5 rounded-lg hover:bg-hover transition-colors"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">
                                                    {work.title}
                                                </p>
                                                <p className="text-xs text-foreground/45 truncate">
                                                    {work.authorName ??
                                                        "未命名用户"}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-warning shrink-0">
                                                <Sparkles className="size-3.5" />
                                                <span className="text-sm font-semibold tabular-nums">
                                                    {formatCount(work.sparks)}
                                                </span>
                                            </div>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card.Content>
                </Card>
            </div>
        </div>
    );
}

function DashboardSkeleton() {
    return (
        <div className="flex flex-col gap-6">
            <Skeleton className="h-9 w-40 rounded-lg" />
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {["a", "b", "c", "d", "e", "f"].map((id) => (
                    <Skeleton key={id} className="h-28 rounded-2xl" />
                ))}
            </div>
            <Skeleton className="h-64 rounded-2xl" />
        </div>
    );
}
