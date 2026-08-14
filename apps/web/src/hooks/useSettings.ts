import { toast } from "@heroui/react";
import { useCallback, useState } from "react";
import useSWR from "swr";
import {
    fetchSettings,
    settingsPath,
    type UserSettings,
    updateSettings,
} from "~/lib/api/settings";
import { useAuth } from "./useAuth";

export function useSettings() {
    const { isLoggedIn } = useAuth();
    const { data, isLoading, error, mutate } = useSWR<UserSettings>(
        isLoggedIn ? settingsPath() : null,
        fetchSettings,
    );
    const [saving, setSaving] = useState(false);

    const save = useCallback(
        async (updates: Partial<Omit<UserSettings, "id" | "userId">>) => {
            setSaving(true);
            try {
                const result = await updateSettings(updates);
                await mutate(result, { revalidate: false });
                toast.success("设置已保存");
                return result;
            } catch {
                toast.danger("保存失败");
                throw new Error("保存失败");
            } finally {
                setSaving(false);
            }
        },
        [mutate],
    );

    return { settings: data, isLoading, error, saving, save };
}
