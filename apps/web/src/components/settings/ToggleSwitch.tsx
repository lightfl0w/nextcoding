import { Switch } from "@heroui/react";

interface ToggleSwitchProps {
    isSelected: boolean;
    onChange: (checked: boolean) => void;
    label: string;
}

/**
 * 功能开关，使用 HeroUI v3 复合结构渲染出滑块外观。
 * @param props.isSelected - 是否开启。
 * @param props.onChange - 切换回调，参数为布尔值。
 * @param props.label - 无障碍标签。
 */
export function ToggleSwitch({
    isSelected,
    onChange,
    label,
}: ToggleSwitchProps) {
    return (
        <Switch
            isSelected={isSelected}
            onChange={onChange}
            aria-label={label}
            size="sm"
        >
            <Switch.Content>
                <Switch.Control>
                    <Switch.Thumb />
                </Switch.Control>
            </Switch.Content>
        </Switch>
    );
}
