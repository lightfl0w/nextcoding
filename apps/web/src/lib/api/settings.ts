import { getJson, mutateJson } from "./http";

export interface UserSettings {
    id: string;
    userId: string;
    notifyOnSpark: boolean;
    notifyOnRemix: boolean;
    notifyOnComment: boolean;
    notifyOnFollow: boolean;
    notifyOnMessage: boolean;
    showActivity: boolean;
    showBookmarks: boolean;
    editorFontSize: number;
    editorFontFamily: string;
    editorTabSize: number;
}

export function settingsPath() {
    return "/api/settings";
}

export async function fetchSettings(path: string): Promise<UserSettings> {
    return getJson<UserSettings>(path);
}

export async function updateSettings(
    updates: Partial<Omit<UserSettings, "id" | "userId">>,
): Promise<UserSettings> {
    return mutateJson<UserSettings>(settingsPath(), "PATCH", updates);
}
