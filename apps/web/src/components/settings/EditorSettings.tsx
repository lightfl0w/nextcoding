import { Button, Card } from "@heroui/react";
import type { UserSettings } from "~/lib/api/settings";

interface EditorSettingsProps {
    settings: UserSettings;
    onChange: (updates: Partial<UserSettings>) => void;
}

const FONT_SIZE_OPTIONS = [12, 13, 14, 15, 16, 18, 20, 22, 24];

const FONT_FAMILY_OPTIONS = [
    { value: "monospace", label: "等宽" },
    { value: "sans-serif", label: "无衬线" },
    { value: "Fira Code, monospace", label: "Fira Code" },
    { value: "JetBrains Mono, monospace", label: "JetBrains Mono" },
];

const TAB_SIZE_OPTIONS = [2, 4];

export function EditorSettings({ settings, onChange }: EditorSettingsProps) {
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
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">
                            字体大小
                        </span>
                        <div className="flex gap-1 flex-wrap justify-end">
                            {FONT_SIZE_OPTIONS.map((size) => (
                                <Button
                                    key={size}
                                    size="sm"
                                    variant={
                                        settings.editorFontSize === size
                                            ? "primary"
                                            : "ghost"
                                    }
                                    onPress={() =>
                                        onChange({ editorFontSize: size })
                                    }
                                    className="min-w-0 px-2"
                                >
                                    {size}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">
                            字体
                        </span>
                        <div className="flex gap-1 flex-wrap justify-end">
                            {FONT_FAMILY_OPTIONS.map((opt) => (
                                <Button
                                    key={opt.value}
                                    size="sm"
                                    variant={
                                        settings.editorFontFamily === opt.value
                                            ? "primary"
                                            : "ghost"
                                    }
                                    onPress={() =>
                                        onChange({
                                            editorFontFamily: opt.value,
                                        })
                                    }
                                    className="min-w-0 px-2"
                                >
                                    {opt.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">
                            缩进大小
                        </span>
                        <div className="flex gap-1">
                            {TAB_SIZE_OPTIONS.map((size) => (
                                <Button
                                    key={size}
                                    size="sm"
                                    variant={
                                        settings.editorTabSize === size
                                            ? "primary"
                                            : "ghost"
                                    }
                                    onPress={() =>
                                        onChange({ editorTabSize: size })
                                    }
                                    className="min-w-0 px-2"
                                >
                                    {size} 个空格
                                </Button>
                            ))}
                        </div>
                    </div>
                </Card.Content>
            </Card>
        </div>
    );
}
