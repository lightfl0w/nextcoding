import { db, userSettings } from "@nextcoding/db";
import { eq } from "drizzle-orm";

export async function findOrCreateSettings(userId: string) {
    const [existing] = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);

    if (existing) {
        return existing;
    }

    const [created] = await db
        .insert(userSettings)
        .values({
            id: crypto.randomUUID(),
            userId,
        })
        .returning();
    return created;
}

export async function updateSettings(
    userId: string,
    updates: Partial<{
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
    }>,
) {
    const [row] = await db
        .update(userSettings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(userSettings.userId, userId))
        .returning();
    return row ?? null;
}
