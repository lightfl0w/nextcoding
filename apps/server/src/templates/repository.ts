import {
    db,
    template,
    templateComment,
    templateCommentLike,
    templateUse,
    user,
    work,
} from "@nextcoding/db";
import { and, count, desc, eq, like, or, sql } from "drizzle-orm";

export type TemplateSort = "hot" | "latest";

export type TemplateStatus = "pending" | "published" | "rejected";

const templateListColumns = {
    id: template.id,
    title: template.title,
    description: template.description,
    category: template.category,
    tags: template.tags,
    coverUrl: template.coverUrl,
    status: template.status,
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
 * 已上架模板列表，按热度或最新排序。
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
    const conditions = [eq(template.status, "published")];
    if (category) {
        conditions.push(eq(template.category, category));
    }
    return db
        .select(templateListColumns)
        .from(template)
        .leftJoin(user, eq(user.id, template.authorId))
        .where(and(...conditions))
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
    status?: TemplateStatus;
}) {
    return db.insert(template).values(values);
}

/**
 * 删除模板记录。
 * @param id - 模板 ID。
 */
export function deleteTemplateById(id: string) {
    return db.delete(template).where(eq(template.id, id));
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
 * 模板热度榜：仅已上架模板，按使用次数排序。
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
        .where(eq(template.status, "published"))
        .orderBy(desc(template.useCount), desc(template.rating))
        .limit(limit);
}

const adminTemplateColumns = {
    ...templateListColumns,
    reviewedAt: template.reviewedAt,
    derivedCount: sql<number>`(
        select count(*) from template_use tu
        where tu.template_id = ${template.id}
    )`,
};

/**
 * 管理后台模板列表：按状态/关键字过滤并分页。
 * @param options.search - 标题或作者名关键字。
 * @param options.status - 审核状态过滤。
 * @param options.page - 页码（从 1 起）。
 * @param options.pageSize - 每页数量。
 */
export async function listAdminTemplates(options: {
    search?: string;
    status?: TemplateStatus;
    page?: number;
    pageSize?: number;
}) {
    const { search, status, page = 1, pageSize = 20 } = options;
    const conditions = [];
    if (search) {
        conditions.push(
            or(
                like(template.title, `%${search}%`),
                like(user.name, `%${search}%`),
            ),
        );
    }
    if (status) {
        conditions.push(eq(template.status, status));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = Math.max(0, (page - 1) * pageSize);

    const [items, [{ total }]] = await Promise.all([
        db
            .select(adminTemplateColumns)
            .from(template)
            .leftJoin(user, eq(user.id, template.authorId))
            .where(where)
            .orderBy(desc(template.createdAt))
            .limit(pageSize)
            .offset(offset),
        db
            .select({ total: count() })
            .from(template)
            .leftJoin(user, eq(user.id, template.authorId))
            .where(where),
    ]);
    return { total, items };
}

/**
 * 更新模板审核状态（通过/驳回），记录处理人与时间。
 * @param id - 模板 ID。
 * @param status - 目标状态。
 * @param adminId - 处理管理员 ID。
 */
export function setTemplateReviewStatus(
    id: string,
    status: TemplateStatus,
    adminId: string,
) {
    return db
        .update(template)
        .set({ status, reviewedBy: adminId, reviewedAt: new Date() })
        .where(eq(template.id, id));
}

const templateCommentColumns = {
    id: templateComment.id,
    content: templateComment.content,
    parentId: templateComment.parentId,
    pinned: templateComment.pinned,
    createdAt: templateComment.createdAt,
    authorId: user.id,
    authorName: user.name,
    authorImage: user.image,
    authorBio: user.bio,
};

/**
 * 模板评论列表（带作者信息）。
 * @param templateId - 模板 ID。
 * @param limit - 返回数量上限。
 */
export function listTemplateComments(
    templateId: string,
    limit: number,
    sort: "time" | "popular",
    userId?: string | null,
) {
    const likeCountCol = sql<number>`(
        select count(*) from template_comment_like
        where template_comment_like.comment_id = ${templateComment.id}
    )`;
    const likedByMeCol = userId
        ? sql<boolean>`exists(
            select 1 from template_comment_like
            where template_comment_like.comment_id = ${templateComment.id}
              and template_comment_like.user_id = ${userId}
        )`
        : sql<boolean>`0`;
    const orderBy =
        sort === "popular"
            ? [
                  desc(templateComment.pinned),
                  desc(likeCountCol),
                  desc(templateComment.createdAt),
              ]
            : [desc(templateComment.pinned), desc(templateComment.createdAt)];

    return db
        .select({
            ...templateCommentColumns,
            likeCount: likeCountCol,
            likedByMe: likedByMeCol,
        })
        .from(templateComment)
        .innerJoin(user, eq(templateComment.userId, user.id))
        .where(eq(templateComment.templateId, templateId))
        .orderBy(...orderBy)
        .limit(limit);
}

export async function deleteTemplateComment(commentId: string) {
    await db.delete(templateComment).where(eq(templateComment.id, commentId));
}

export async function setTemplateCommentPinned(
    commentId: string,
    pinned: boolean,
) {
    await db
        .update(templateComment)
        .set({ pinned })
        .where(eq(templateComment.id, commentId));
}

export async function toggleTemplateCommentLike(
    commentId: string,
    userId: string,
) {
    const [existing] = await db
        .select({ commentId: templateCommentLike.commentId })
        .from(templateCommentLike)
        .where(
            and(
                eq(templateCommentLike.commentId, commentId),
                eq(templateCommentLike.userId, userId),
            ),
        )
        .limit(1);

    if (existing) {
        await db
            .delete(templateCommentLike)
            .where(
                and(
                    eq(templateCommentLike.commentId, commentId),
                    eq(templateCommentLike.userId, userId),
                ),
            );
    } else {
        await db.insert(templateCommentLike).values({ commentId, userId });
    }

    const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(templateCommentLike)
        .where(eq(templateCommentLike.commentId, commentId));

    return { liked: !existing, likeCount: count };
}

export async function findTemplateComment(commentId: string) {
    const [row] = await db
        .select({
            id: templateComment.id,
            templateId: templateComment.templateId,
            parentId: templateComment.parentId,
            userId: templateComment.userId,
        })
        .from(templateComment)
        .where(eq(templateComment.id, commentId))
        .limit(1);
    return row ?? null;
}

/**
 * 新增模板评论，返回新评论 ID 与创建时间。
 */
export async function insertTemplateComment(values: {
    templateId: string;
    userId: string;
    parentId: string | null;
    content: string;
}) {
    const [row] = await db
        .insert(templateComment)
        .values({ id: crypto.randomUUID(), ...values })
        .returning({
            id: templateComment.id,
            createdAt: templateComment.createdAt,
        });
    return row;
}
