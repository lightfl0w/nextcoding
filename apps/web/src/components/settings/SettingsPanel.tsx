import { Button, Card, Spinner } from "@heroui/react";
import { Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SectionHeading } from "~/components/ui/SectionHeading";
import { useAuth } from "~/hooks/useAuth";
import { useSettings } from "~/hooks/useSettings";
import type { UserSettings } from "~/lib/api";
import { EditorSettings } from "./EditorSettings";
import { NotificationSettings } from "./NotificationSettings";
import { PrivacySettings } from "./PrivacySettings";

export function SettingsPanel() {
    const { isLoggedIn, isPending: authPending } = useAuth();
    const { settings, isLoading, saving, save } = useSettings();
    const [draft, setDraft] = useState<Partial<UserSettings>>({});

    useEffect(() => {
        if (settings) {
            setDraft({});
        }
    }, [settings]);

    const handleChange = useCallback((updates: Partial<UserSettings>) => {
        setDraft((prev) => ({ ...prev, ...updates }));
    }, []);

    const handleSave = useCallback(async () => {
        if (Object.keys(draft).length === 0) {
            return;
        }
        await save(draft);
        setDraft({});
    }, [draft, save]);

    if (authPending || isLoading) {
        return (
            <div className="p-8 w-full flex items-center justify-center">
                <Spinner />
            </div>
        );
    }

    if (!isLoggedIn || !settings) {
        return null;
    }

    const current = { ...settings, ...draft } as UserSettings;
    const hasChanges = Object.keys(draft).length > 0;

    return (
        <div className="flex flex-col gap-6">
            <Card className="p-0 shadow-none rounded-2xl border border-default-200/70">
                <Card.Content className="p-6 flex flex-col gap-8">
                    <section className="flex flex-col gap-4">
                        <SectionHeading title="通知偏好" />
                        <NotificationSettings
                            settings={current}
                            onChange={handleChange}
                        />
                    </section>

                    <section className="flex flex-col gap-4">
                        <SectionHeading title="隐私设置" />
                        <PrivacySettings
                            settings={current}
                            onChange={handleChange}
                        />
                    </section>

                    <section className="flex flex-col gap-4">
                        <SectionHeading title="编辑器偏好" />
                        <EditorSettings
                            settings={current}
                            onChange={handleChange}
                        />
                    </section>
                </Card.Content>
            </Card>

            {hasChanges && (
                <div className="flex justify-end">
                    <Button
                        variant="primary"
                        onPress={handleSave}
                        isDisabled={saving}
                        className="gap-1.5"
                    >
                        <Save className="size-4" />
                        {saving ? "保存中…" : "保存设置"}
                    </Button>
                </div>
            )}
        </div>
    );
}
