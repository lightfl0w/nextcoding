import type { UserSettings } from "~/lib/api/settings";

/**
 * 设置区块通用 props。
 * @param settings - 当前设置（含未保存草稿）。
 * @param onChange - 提交部分更新。
 */
export interface SettingsSectionProps {
    settings: UserSettings;
    onChange: (updates: Partial<UserSettings>) => void;
}
