import { Card } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LeaderboardTable } from "~/components/leaderboard/LeaderboardTable";
import { LeaderboardTabs } from "~/components/leaderboard/LeaderboardTabs";
import { PageHeader } from "~/components/ui/PageHeader";
import { useLeaderboard } from "~/hooks/useLeaderboard";
import type { LeaderboardPeriod, LeaderboardType } from "~/lib/api";

export const Route = createFileRoute("/leaderboard")({
    component: LeaderboardPage,
});

function LeaderboardPage() {
    const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
    const [type, setType] = useState<LeaderboardType>("works");
    const { data, isLoading } = useLeaderboard(period, type, 20);

    return (
        <div className="mx-auto w-full max-w-5xl p-8 flex flex-col gap-6">
            <PageHeader
                title="排行榜"
                description="发现社区中最受欢迎的作品和贡献者"
            />

            <Card className="p-0 shadow-none rounded-2xl border border-default-200/70">
                <Card.Content className="p-6 flex flex-col gap-6">
                    <LeaderboardTabs
                        period={period}
                        type={type}
                        onPeriodChange={setPeriod}
                        onTypeChange={setType}
                    />
                    <LeaderboardTable
                        items={data ?? []}
                        type={type}
                        isLoading={isLoading}
                    />
                </Card.Content>
            </Card>
        </div>
    );
}
