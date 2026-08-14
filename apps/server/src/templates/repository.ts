import { db, template } from "@nextcoding/db";
import { and, desc, eq, sql } from "drizzle-orm";

export function listTemplates(category?: string, limit = 50) {
    const conditions = category ? eq(template.category, category) : undefined;

    return db
        .select()
        .from(template)
        .where(and(conditions))
        .orderBy(desc(template.useCount), desc(template.createdAt))
        .limit(limit);
}

export async function findTemplate(id: string) {
    const [row] = await db
        .select()
        .from(template)
        .where(eq(template.id, id))
        .limit(1);
    return row ?? null;
}

export function bumpTemplateUseCount(id: string) {
    return db
        .update(template)
        .set({ useCount: sql`${template.useCount} + 1` })
        .where(eq(template.id, id));
}

export function createTemplate(values: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    tags: string;
    snapshotKey: string;
    fileCount: number;
}) {
    return db.insert(template).values(values);
}
