import { Button, Card } from "@heroui/react";
import type { SettingsSectionProps } from "./types";

const FONT_SIZE_OPTIONS = [12, 13, 14, 15, 16, 18, 20, 22, 24].map((value) => ({
    value,
    label: String(value),
}));

const FONT_FAMILY_OPTIONS = [
    { value: "monospace", label: "等宽" },
    { value: "sans-serif", label: "无衬线" },
    { value: "Fira Code, monospace", label: "Fira Code" },
    { value: "JetBrains Mono, monospace", label: "JetBrains Mono" },
];

const TAB_SIZE_OPTIONS = [2, 4].map((value) => ({
    value,
    label: `${value} 个空格`,
}));

export function EditorSettings({ settings, onChange }: SettingsSectionProps) {
    return (
        <div className="flex flex-col gap-4">
            <div>
                <h3 className="text-base font-medium text-foreground">
                    编辑器设置
                </h3>
                <p className="text-sm text-foreground/45 mt-1">
                    自定义代码编辑器的显示偏好
                </p>
            </div>
            <Card className="p-0 shadow-none rounded-2xl border border-default-200/70">
                <Card.Content className="flex flex-col gap-5 py-5 px-5">
                    <OptionGroup
                        label="字体大小"
                        options={FONT_SIZE_OPTIONS}
                        selected={settings.editorFontSize}
                        onSelect={(value) =>
                            onChange({ editorFontSize: value })
                        }
                    />
                    <OptionGroup
                        label="字体"
                        options={FONT_FAMILY_OPTIONS}
                        selected={settings.editorFontFamily}
                        onSelect={(value) =>
                            onChange({ editorFontFamily: value })
                        }
                    />
                    <OptionGroup
                        label="缩进大小"
                        options={TAB_SIZE_OPTIONS}
                        selected={settings.editorTabSize}
                        onSelect={(value) => onChange({ editorTabSize: value })}
                    />
                </Card.Content>
            </Card>
        </div>
    );
}

function OptionGroup<T extends string | number>({
    label,
    options,
    selected,
    onSelect,
}: {
    label: string;
    options: ReadonlyArray<{ value: T; label: string }>;
    selected: T;
    onSelect: (value: T) => void;
}) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{label}</span>
            <div className="flex gap-1 flex-wrap justify-end">
                {options.map((option) => (
                    <Button
                        key={option.value}
                        size="sm"
                        variant={
                            selected === option.value ? "primary" : "ghost"
                        }
                        onPress={() => onSelect(option.value)}
                        className="min-w-0 px-2"
                    >
                        {option.label}
                    </Button>
                ))}
            </div>
        </div>
    );
}
