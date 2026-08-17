import { Tabs } from "@heroui/react";

interface FilterTabsProps<T extends string> {
    label: string;
    value: T;
    options: Array<{ value: T; label: string }>;
    onChange: (value: T) => void;
}

/**
 * 管理列表筛选 Tab（全部/单选切换）。
 */
export function FilterTabs<T extends string>({
    label,
    value,
    options,
    onChange,
}: FilterTabsProps<T>) {
    return (
        <Tabs
            selectedKey={value}
            onSelectionChange={(key) => onChange(key as T)}
            aria-label={label}
        >
            <Tabs.ListContainer>
                <Tabs.List>
                    {options.map((option) => (
                        <Tabs.Tab key={option.value} id={option.value}>
                            {option.label}
                            <Tabs.Indicator />
                        </Tabs.Tab>
                    ))}
                </Tabs.List>
            </Tabs.ListContainer>
        </Tabs>
    );
}
