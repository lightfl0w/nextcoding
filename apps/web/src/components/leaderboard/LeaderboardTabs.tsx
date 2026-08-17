import { Tabs } from "@heroui/react";
import type { LeaderboardPeriod, LeaderboardType } from "~/lib/api/leaderboard";

interface LeaderboardTabsProps {
    period: LeaderboardPeriod;
    type: LeaderboardType;
    onPeriodChange: (period: LeaderboardPeriod) => void;
    onTypeChange: (type: LeaderboardType) => void;
}

const PERIOD_TABS: Array<{ id: LeaderboardPeriod; label: string }> = [
    { id: "weekly", label: "本周" },
    { id: "monthly", label: "本月" },
    { id: "all", label: "全部" },
];

const TYPE_TABS: Array<{ id: LeaderboardType; label: string }> = [
    { id: "works", label: "作品" },
    { id: "contributors", label: "作者" },
];

export function LeaderboardTabs({
    period,
    type,
    onPeriodChange,
    onTypeChange,
}: LeaderboardTabsProps) {
    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
                selectedKey={period}
                onSelectionChange={(key) =>
                    onPeriodChange(key as LeaderboardPeriod)
                }
                aria-label="排行榜时间范围"
            >
                <Tabs.ListContainer>
                    <Tabs.List>
                        {PERIOD_TABS.map((tab) => (
                            <Tabs.Tab key={tab.id} id={tab.id}>
                                {tab.label}
                                <Tabs.Indicator />
                            </Tabs.Tab>
                        ))}
                    </Tabs.List>
                </Tabs.ListContainer>
            </Tabs>

            <Tabs
                selectedKey={type}
                onSelectionChange={(key) =>
                    onTypeChange(key as LeaderboardType)
                }
                aria-label="排行榜类型"
            >
                <Tabs.ListContainer>
                    <Tabs.List>
                        {TYPE_TABS.map((tab) => (
                            <Tabs.Tab key={tab.id} id={tab.id}>
                                {tab.label}
                                <Tabs.Indicator />
                            </Tabs.Tab>
                        ))}
                    </Tabs.List>
                </Tabs.ListContainer>
            </Tabs>
        </div>
    );
}
