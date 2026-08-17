import { Card } from "@heroui/react";
import type { UserSettings } from "~/lib/api/settings";
import { ToggleSwitch } from "./ToggleSwitch";
import type { SettingsSectionProps } from "./types";

const PRIVACY_OPTIONS: Array<{
    key: keyof Pick<UserSettings, "showActivity" | "showBookmarks">;
    label: string;
    description: string;
}> = [
    {
        key: "showActivity",
        label: "是否公开动态",
        description: "其他用户可以查看你的动态记录",
    },
    {
        key: "showBookmarks",
        label: "是否公开收藏",
        description: "其他用户可以查看你的收藏列表",
    },
];

export function PrivacySettings({ settings, onChange }: SettingsSectionProps) {
    return (
        <div className="flex flex-col gap-4">
            <div>
                <h3 className="text-base font-medium text-foreground">
                    隐私设置
                </h3>
                <p className="text-sm text-foreground/45 mt-1">
                    控制哪些信息公开可见
                </p>
            </div>
            <Card className="p-0 shadow-none rounded-2xl border border-default-200/70">
                <Card.Content className="divide-y divide-default-200/70">
                    {PRIVACY_OPTIONS.map((option) => (
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
