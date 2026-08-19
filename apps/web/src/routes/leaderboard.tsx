import { Card } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LeaderboardTable } from "~/components/leaderboard/LeaderboardTable";
import { LeaderboardTabs } from "~/components/leaderboard/LeaderboardTabs";
import { PopularWorks } from "~/components/leaderboard/PopularWorks";
import { TemplateLeaderboardList } from "~/components/templates/TemplateLeaderboardList";
import { PageHeader } from "~/components/ui/PageHeader";
import { useLeaderboard } from "~/hooks/useLeaderboard";
import type { LeaderboardPeriod, LeaderboardType } from "~/lib/api";

interface LeaderboardSearch {
    type?: LeaderboardType;
    period?: LeaderboardPeriod;
}

function parseSearch(search: Record<string, unknown>): LeaderboardSearch {
    const type = search.type;
    const period = search.period;
    return {
        type:
            type === "works" || type === "contributors" || type === "templates"
                ? type
                : undefined,
        period:
            period === "weekly" || period === "monthly" || period === "all"
                ? period
                : undefined,
    };
}

export const Route = createFileRoute("/leaderboard")({
    validateSearch: parseSearch,
    component: LeaderboardPage,
});

function LeaderboardPage() {
    const initial = Route.useSearch();
    const [period, setPeriod] = useState<LeaderboardPeriod>(
        initial.period ?? "weekly",
    );
    const [type, setType] = useState<LeaderboardType>(initial.type ?? "works");
    const { data, isLoading } = useLeaderboard(period, type, 20);

    return (
        <div className="mx-auto w-full max-w-6xl p-8 flex flex-col lg:flex-row gap-6 items-start">
            <div className="flex-1 min-w-0 flex flex-col gap-6">
                <PageHeader
                    title="排行榜"
                    description="发现社区中最受欢迎的作品、贡献者和模板"
                />

                <Card className="p-0 shadow-none rounded-2xl border border-default-200/70">
                    <Card.Content className="p-6 flex flex-col gap-6">
                        <LeaderboardTabs
                            period={period}
                            type={type}
                            onPeriodChange={setPeriod}
                            onTypeChange={setType}
                        />
                        {type === "templates" ? (
                            <TemplateLeaderboardList limit={20} />
                        ) : (
                            <LeaderboardTable
                                items={data ?? []}
                                type={type}
                                isLoading={isLoading}
                            />
                        )}
                    </Card.Content>
                </Card>
            </div>

            <aside className="hidden lg:flex flex-col gap-4 w-72 shrink-0 sticky top-8 self-start">
                <PopularWorks />
            </aside>
        </div>
    );
}
