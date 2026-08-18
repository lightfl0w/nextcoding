import { db, template, templateUse, user, work } from "@nextcoding/db";
import { and, count, desc, eq, sql } from "drizzle-orm";

export type TemplateSort = "hot" | "latest";

const templateListColumns = {
    id: template.id,
    title: template.title,
    description: template.description,
    category: template.category,
    tags: template.tags,
    coverUrl: template.coverUrl,
    fileCount: template.fileCount,
    useCount: template.useCount,
    rating: template.rating,
    ratingCount: template.ratingCount,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    authorId: user.id,
    authorName: user.name,
    authorImage: user.image,
};

/**
 * 模板列表，按热度或最新排序。
 * @param category - 分类筛选；缺省返回全部分类。
 * @param sort - `hot` 按使用次数，`latest` 按创建时间。
 * @param limit - 返回数量上限。
 */
export function listTemplates(
    category?: string,
    sort: TemplateSort = "hot",
    limit = 50,
) {
    const orderBy =
        sort === "latest"
            ? [desc(template.createdAt)]
            : [
                  desc(template.useCount),
                  desc(template.rating),
                  desc(template.createdAt),
              ];
    return db
        .select(templateListColumns)
        .from(template)
        .leftJoin(user, eq(user.id, template.authorId))
        .where(category ? eq(template.category, category) : undefined)
        .orderBy(...orderBy)
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

/**
 * 模板详情，附带作者与派生作品数量。
 * @param id - 模板 ID。
 */
export async function findTemplateDetail(id: string) {
    const [row] = await db
        .select({
            ...templateListColumns,
            snapshotKey: template.snapshotKey,
            derivedCount: sql<number>`(
                select count(*) from template_use tu
                where tu.template_id = ${template.id}
            )`,
        })
        .from(template)
        .leftJoin(user, eq(user.id, template.authorId))
        .where(eq(template.id, id))
        .limit(1);
    return row ?? null;
}

/**
 * 按来源作品查询模板记录。
 * @param workId - 作品 ID。
 */
export async function findTemplateByWork(workId: string) {
    const [row] = await db
        .select()
        .from(template)
        .where(eq(template.workId, workId))
        .limit(1);
    return row ?? null;
}

/**
 * 按来源作品删除模板记录。
 * @param workId - 作品 ID。
 */
export function deleteTemplateByWork(workId: string) {
    return db.delete(template).where(eq(template.workId, workId));
}

export function bumpTemplateUseCount(id: string) {
    return db
        .update(template)
        .set({ useCount: sql`${template.useCount} + 1` })
        .where(eq(template.id, id));
}

export function createTemplate(values: {
    id: string;
    authorId: string | null;
    workId: string | null;
    title: string;
    description: string | null;
    category: string | null;
    tags: string;
    coverUrl: string | null;
    snapshotKey: string;
    fileCount: number;
}) {
    return db.insert(template).values(values);
}

/**
 * 记录一次模板使用，并把派生作品标记为「基于该模板」。
 * @param templateId - 模板 ID。
 * @param workId - 派生作品 ID。
 * @param userId - 使用者 ID。
 */
export async function insertTemplateUse(values: {
    templateId: string;
    workId: string;
    userId: string;
}) {
    await db.insert(templateUse).values({
        id: crypto.randomUUID(),
        ...values,
    });
    return db
        .update(work)
        .set({ templateId: values.templateId })
        .where(eq(work.id, values.workId));
}

const templateUseColumns = {
    id: templateUse.id,
    createdAt: templateUse.createdAt,
    userId: user.id,
    userName: user.name,
    userImage: user.image,
    workId: work.id,
    workTitle: work.title,
    workStatus: work.status,
    workViews: work.views,
    workLikes: work.likes,
    workSparks: work.sparks,
    commentCount: sql<number>`(
        select count(*) from work_comment wc where wc.work_id = ${work.id}
    )`,
};

/**
 * 模板使用记录列表（派生作品 + 使用者 + 互动数据）。
 * @param templateId - 模板 ID。
 * @param limit - 返回数量上限。
 */
export function listTemplateUses(templateId: string, limit = 50) {
    return db
        .select(templateUseColumns)
        .from(templateUse)
        .innerJoin(user, eq(user.id, templateUse.userId))
        .innerJoin(work, eq(work.id, templateUse.workId))
        .where(eq(templateUse.templateId, templateId))
        .orderBy(desc(templateUse.createdAt))
        .limit(limit);
}

export async function countTemplateUses(templateId: string) {
    const [row] = await db
        .select({ total: count() })
        .from(templateUse)
        .where(eq(templateUse.templateId, templateId));
    return row?.total ?? 0;
}

/**
 * 模板派生作品的互动数据汇总。
 * @param templateId - 模板 ID。
 */
export async function sumTemplateDerivedStats(templateId: string) {
    const [row] = await db
        .select({
            works: count(),
            likes: sql<number>`coalesce(sum(${work.likes}), 0)`,
            sparks: sql<number>`coalesce(sum(${work.sparks}), 0)`,
            comments: sql<number>`(
                select count(*) from work_comment wc
                inner join template_use tu2 on tu2.work_id = wc.work_id
                where tu2.template_id = ${templateId}
            )`,
        })
        .from(templateUse)
        .innerJoin(work, eq(work.id, templateUse.workId))
        .where(eq(templateUse.templateId, templateId));
    return {
        works: row?.works ?? 0,
        likes: row?.likes ?? 0,
        sparks: row?.sparks ?? 0,
        comments: row?.comments ?? 0,
    };
}

/**
 * 提交评分（1-5 星），更新模板的平均分与评分人数。
 * @param id - 模板 ID。
 * @param score - 评分（1-5）。
 */
export function rateTemplate(id: string, score: number) {
    return db
        .update(template)
        .set({
            rating: sql`cast(round((${template.rating} * ${template.ratingCount} + ${score} * 10) * 1.0 / (${template.ratingCount} + 1)) as integer)`,
            ratingCount: sql`${template.ratingCount} + 1`,
        })
        .where(eq(template.id, id));
}

/**
 * 查询作品是否已被标记为模板并计数。
 * @param workId - 作品 ID。
 */
export async function findWorkTemplateFlag(workId: string) {
    const [row] = await db
        .select({
            isTemplate: work.isTemplate,
            templateUseCount: work.templateUseCount,
        })
        .from(work)
        .where(eq(work.id, workId))
        .limit(1);
    return row ?? null;
}

/**
 * 更新作品的模板开关状态。
 * @param workId - 作品 ID。
 * @param isTemplate - 是否允许作为模板。
 */
export function setWorkIsTemplate(workId: string, isTemplate: boolean) {
    return db.update(work).set({ isTemplate }).where(eq(work.id, workId));
}

/**
 * 作品被用作模板一次（useCount 累计）。
 * @param workId - 作品 ID。
 */
export function bumpWorkTemplateUseCount(workId: string) {
    return db
        .update(work)
        .set({ templateUseCount: sql`${work.templateUseCount} + 1` })
        .where(and(eq(work.id, workId), eq(work.isTemplate, true)));
}

/**
 * 模板热度榜：全量按使用次数排序。
 * @param limit - 返回数量上限。
 */
export function listTemplateLeaderboard(limit = 10) {
    return db
        .select({
            ...templateListColumns,
            derivedCount: sql<number>`(
                select count(*) from template_use tu
                where tu.template_id = ${template.id}
            )`,
        })
        .from(template)
        .leftJoin(user, eq(user.id, template.authorId))
        .orderBy(desc(template.useCount), desc(template.rating))
        .limit(limit);
}
