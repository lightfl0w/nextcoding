import { Card } from "@heroui/react";
import type { UserSettings } from "~/lib/api/settings";
import { ToggleSwitch } from "./ToggleSwitch";
import type { SettingsSectionProps } from "./types";

const NOTIFICATION_OPTIONS: Array<{
    key: keyof Pick<
        UserSettings,
        | "notifyOnSpark"
        | "notifyOnRemix"
        | "notifyOnComment"
        | "notifyOnFollow"
        | "notifyOnMessage"
    >;
    label: string;
    description: string;
}> = [
    {
        key: "notifyOnSpark",
        label: "火花通知",
        description: "有人给你的作品送火花时通知",
    },
    {
        key: "notifyOnRemix",
        label: "二创通知",
        description: "有人二创你的作品时通知",
    },
    {
        key: "notifyOnComment",
        label: "评论通知",
        description: "有人评论你的作品时通知",
    },
    {
        key: "notifyOnFollow",
        label: "关注通知",
        description: "有人关注你时通知",
    },
    {
        key: "notifyOnMessage",
        label: "私信通知",
        description: "收到新私信时通知",
    },
];

export function NotificationSettings({
    settings,
    onChange,
}: SettingsSectionProps) {
    return (
        <div className="flex flex-col gap-4">
            <div>
                <h3 className="text-base font-medium text-foreground">
                    通知设置
                </h3>
                <p className="text-sm text-foreground/45 mt-1">
                    选择你想接收的通知类型
                </p>
            </div>
            <Card className="p-0 shadow-none rounded-2xl border border-default-200/70">
                <Card.Content className="divide-y divide-default-200/70">
                    {NOTIFICATION_OPTIONS.map((option) => (
                        <div
                            key={option.key}
                            className="flex items-center justify-between py-4 px-1"
                        >
                            <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium text-foreground">
                                    {option.label}
                                </span>
                                <span className="text-xs text-foreground/45">
                                    {option.description}
                                </span>
                            </div>
                            <ToggleSwitch
                                isSelected={settings[option.key]}
                                onChange={(checked) =>
                                    onChange({ [option.key]: checked })
                                }
                                label={option.label}
                            />
                        </div>
                    ))}
                </Card.Content>
            </Card>
        </div>
    );
}
