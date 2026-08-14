import {
    account,
    activity,
    bookmark,
    conversation,
    db,
    follow,
    message,
    notification,
    remix,
    session,
    spark,
    tag,
    user,
    userAchievement,
    userSettings,
    work,
    workComment,
    workFile,
    workTag,
    workVersion,
} from "@nextcoding/db";
import { and, count, desc, eq, gte, inArray, like, or, sql } from "drizzle-orm";

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 7;
const RECENT_USERS_LIMIT = 8;
const TOP_WORKS_LIMIT = 5;

export const ADMIN_PAGE_SIZE_DEFAULT = 20;
export const ADMIN_PAGE_SIZE_MAX = 50;

/**
 * 把页码收敛到 ≥1 的整数。
 */
export function clampPage(raw: string | undefined): number {
    const page = Number(raw);
    return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

/**
 * 把每页条数收敛到合法区间。
 */
export function clampPageSize(raw: string | undefined): number {
    const size = Number(raw);
    if (!Number.isFinite(size) || size <= 0) {
        return ADMIN_PAGE_SIZE_DEFAULT;
    }
    return Math.min(Math.floor(size), ADMIN_PAGE_SIZE_MAX);
}

function escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function startOfToday(): number {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function formatDay(timestamp: number): string {
    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

export interface DashboardStats {
    users: number;
    works: number;
    publishedWorks: number;
    comments: number;
    tags: number;
    sparks: number;
    views: number;
    trend: Array<{
        date: string;
        label: string;
        users: number;
        works: number;
    }>;
    recentUsers: Array<{
        id: string;
        name: string;
        email: string;
        image: string | null;
        createdAt: Date;
    }>;
    topWorks: Array<{
        id: string;
        title: string;
        sparks: number;
        views: number;
        authorId: string;
        authorName: string;
    }>;
}

/**
 * 仪表盘汇总统计：总量指标 + 近 7 天新增趋势 + 最新注册用户 + 热门作品。
 */
export async function getDashboardStats(): Promise<DashboardStats> {
    const [users, works, publishedWorks, comments, tags, sparks, views] =
        await Promise.all([
            db
                .select({ value: count(user.id) })
                .from(user)
                .get(),
            db
                .select({ value: count(work.id) })
                .from(work)
                .get(),
            db
                .select({ value: count(work.id) })
                .from(work)
                .where(eq(work.status, "published"))
                .get(),
            db
                .select({ value: count(workComment.id) })
                .from(workComment)
                .get(),
            db
                .select({ value: count(tag.id) })
                .from(tag)
                .get(),
            db
                .select({
                    value: sql<number>`coalesce(sum(${work.sparks}), 0)`,
                })
                .from(work)
                .get(),
            db
                .select({ value: sql<number>`coalesce(sum(${work.views}), 0)` })
                .from(work)
                .get(),
        ]);

    const since = startOfToday() - (TREND_DAYS - 1) * DAY_MS;
    const dayExpr = sql<string>`strftime('%Y-%m-%d', ${user.createdAt} / 1000, 'unixepoch')`;
    const workDayExpr = sql<string>`strftime('%Y-%m-%d', ${work.createdAt} / 1000, 'unixepoch')`;

    const [userTrend, workTrend, recentUsers, topWorks] = await Promise.all([
        db
            .select({ day: dayExpr, value: count(user.id) })
            .from(user)
            .where(gte(user.createdAt, new Date(since)))
            .groupBy(dayExpr)
            .all(),
        db
            .select({ day: workDayExpr, value: count(work.id) })
            .from(work)
            .where(gte(work.createdAt, new Date(since)))
            .groupBy(workDayExpr)
            .all(),
        db
            .select({
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
                createdAt: user.createdAt,
            })
            .from(user)
            .orderBy(desc(user.createdAt))
            .limit(RECENT_USERS_LIMIT)
            .all(),
        db
            .select({
                id: work.id,
                title: work.title,
                sparks: work.sparks,
                views: work.views,
                authorId: user.id,
                authorName: user.name,
            })
            .from(work)
            .innerJoin(user, eq(work.userId, user.id))
            .where(eq(work.status, "published"))
            .orderBy(desc(work.sparks), desc(work.views))
            .limit(TOP_WORKS_LIMIT)
            .all(),
    ]);

    const userMap = new Map(userTrend.map((row) => [row.day, row.value]));
    const workMap = new Map(workTrend.map((row) => [row.day, row.value]));
    const trend = Array.from({ length: TREND_DAYS }, (_, i) => {
        const timestamp = since + i * DAY_MS;
        const date = formatDay(timestamp);
        return {
            date,
            label: date.slice(5),
            users: userMap.get(date) ?? 0,
            works: workMap.get(date) ?? 0,
        };
    });

    return {
        users: users?.value ?? 0,
        works: works?.value ?? 0,
        publishedWorks: publishedWorks?.value ?? 0,
        comments: comments?.value ?? 0,
        tags: tags?.value ?? 0,
        sparks: sparks?.value ?? 0,
        views: views?.value ?? 0,
        trend,
        recentUsers,
        topWorks,
    };
}

export interface AdminUserFilters {
    search?: string;
    role?: string;
    banned?: boolean;
    page: number;
    pageSize: number;
}

/**
 * 用户列表：支持名称/邮箱模糊搜索、角色与封禁状态筛选，返回分页计数。
 */
export async function listUsers(filters: AdminUserFilters) {
    const conditions = [];
    if (filters.search) {
        const keyword = `%${escapeLike(filters.search)}%`;
        conditions.push(
            or(like(user.name, keyword), like(user.email, keyword)),
        );
    }
    if (filters.role) {
        conditions.push(eq(user.role, filters.role));
    }
    if (filters.banned !== undefined) {
        conditions.push(eq(user.banned, filters.banned));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow, items] = await Promise.all([
        db
            .select({ value: count(user.id) })
            .from(user)
            .where(where)
            .get(),
        db
            .select({
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
                bio: user.bio,
                role: user.role,
                banned: user.banned,
                banReason: user.banReason,
                banExpires: user.banExpires,
                emailVerified: user.emailVerified,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                workCount: sql<number>`(select count(*) from ${work} where ${work.userId} = ${user.id})`,
            })
            .from(user)
            .where(where)
            .orderBy(desc(user.createdAt))
            .limit(filters.pageSize)
            .offset((filters.page - 1) * filters.pageSize)
            .all(),
    ]);

    return { total: totalRow?.value ?? 0, items };
}

export function findAdminUserById(id: string) {
    return db
        .select({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            banned: user.banned,
        })
        .from(user)
        .where(eq(user.id, id))
        .get();
}

export async function setUserRole(id: string, role: "admin" | "user") {
    await db.update(user).set({ role }).where(eq(user.id, id));
}

export async function banUser(
    id: string,
    reason: string | null,
    expiresAt: Date | null,
) {
    await db
        .update(user)
        .set({ banned: true, banReason: reason, banExpires: expiresAt })
        .where(eq(user.id, id));
}

export async function unbanUser(id: string) {
    await db
        .update(user)
        .set({ banned: false, banReason: null, banExpires: null })
        .where(eq(user.id, id));
}

export interface AdminWorkFilters {
    search?: string;
    status?: "draft" | "published";
    page: number;
    pageSize: number;
}

/**
 * 作品列表：标题模糊搜索 + 状态筛选，附带作者信息与分页计数。
 */
export async function listWorks(filters: AdminWorkFilters) {
    const conditions = [];
    if (filters.search) {
        conditions.push(like(work.title, `%${escapeLike(filters.search)}%`));
    }
    if (filters.status) {
        conditions.push(eq(work.status, filters.status));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow, items] = await Promise.all([
        db
            .select({ value: count(work.id) })
            .from(work)
            .where(where)
            .get(),
        db
            .select({
                id: work.id,
                title: work.title,
                status: work.status,
                views: work.views,
                likes: work.likes,
                sparks: work.sparks,
                createdAt: work.createdAt,
                updatedAt: work.updatedAt,
                authorId: user.id,
                authorName: user.name,
            })
            .from(work)
            .innerJoin(user, eq(work.userId, user.id))
            .where(where)
            .orderBy(desc(work.createdAt))
            .limit(filters.pageSize)
            .offset((filters.page - 1) * filters.pageSize)
            .all(),
    ]);

    return { total: totalRow?.value ?? 0, items };
}

export interface AdminCommentFilters {
    search?: string;
    page: number;
    pageSize: number;
}

/**
 * 评论列表：内容模糊搜索，附带作者与所属作品信息及分页计数。
 */
export async function listComments(filters: AdminCommentFilters) {
    const conditions = [];
    if (filters.search) {
        conditions.push(
            like(workComment.content, `%${escapeLike(filters.search)}%`),
        );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow, items] = await Promise.all([
        db
            .select({ value: count(workComment.id) })
            .from(workComment)
            .where(where)
            .get(),
        db
            .select({
                id: workComment.id,
                content: workComment.content,
                parentId: workComment.parentId,
                createdAt: workComment.createdAt,
                workId: work.id,
                workTitle: work.title,
                authorId: user.id,
                authorName: user.name,
                authorImage: user.image,
            })
            .from(workComment)
            .innerJoin(user, eq(workComment.userId, user.id))
            .innerJoin(work, eq(workComment.workId, work.id))
            .where(where)
            .orderBy(desc(workComment.createdAt))
            .limit(filters.pageSize)
            .offset((filters.page - 1) * filters.pageSize)
            .all(),
    ]);

    return { total: totalRow?.value ?? 0, items };
}

/**
 * 标签列表：按作品数降序，便于后台查看热门标签。
 */
export function listAdminTags() {
    return db
        .select({
            id: tag.id,
            name: tag.name,
            slug: tag.slug,
            description: tag.description,
            color: tag.color,
            workCount: tag.workCount,
            createdAt: tag.createdAt,
        })
        .from(tag)
        .orderBy(desc(tag.workCount), tag.name);
}

export function findAdminTagById(id: string) {
    return db
        .select({ id: tag.id, name: tag.name })
        .from(tag)
        .where(eq(tag.id, id))
        .get();
}

export function findAdminWorkById(id: string) {
    return db
        .select({ id: work.id, title: work.title })
        .from(work)
        .where(eq(work.id, id))
        .get();
}

export function findAdminCommentById(id: string) {
    return db
        .select({ id: workComment.id, content: workComment.content })
        .from(workComment)
        .where(eq(workComment.id, id))
        .get();
}

/**
 * 删除一批评论及其回复、关联的通知与动态。
 */
export async function deleteCommentRows(commentIds: string[]) {
    if (commentIds.length === 0) {
        return;
    }
    const replies = await db
        .select({ id: workComment.id })
        .from(workComment)
        .where(inArray(workComment.parentId, commentIds))
        .all();
    if (replies.length > 0) {
        await deleteCommentRows(replies.map((reply) => reply.id));
    }
    await db
        .delete(notification)
        .where(inArray(notification.commentId, commentIds));
    await db.delete(activity).where(inArray(activity.commentId, commentIds));
    await db.delete(workComment).where(inArray(workComment.id, commentIds));
}

/**
 * 删除一批作品及其文件、版本、评论、点赞、收藏、派生关系与标签关联。
 * 用于作品删除与用户删除，保证不残留孤儿数据。
 */
export async function deleteWorkRows(workIds: string[]) {
    if (workIds.length === 0) {
        return;
    }
    const commentIds = await db
        .select({ id: workComment.id })
        .from(workComment)
        .where(inArray(workComment.workId, workIds))
        .all();
    await deleteCommentRows(commentIds.map((comment) => comment.id));

    await db.delete(workFile).where(inArray(workFile.workId, workIds));
    await db.delete(workVersion).where(inArray(workVersion.workId, workIds));
    await db.delete(spark).where(inArray(spark.workId, workIds));
    await db.delete(bookmark).where(inArray(bookmark.workId, workIds));
    await db.delete(remix).where(inArray(remix.originalId, workIds));
    await db.delete(remix).where(inArray(remix.forkId, workIds));
    await db.delete(notification).where(inArray(notification.workId, workIds));
    await db.delete(activity).where(inArray(activity.workId, workIds));

    const tagRows = await db
        .select({ tagId: workTag.tagId })
        .from(workTag)
        .where(inArray(workTag.workId, workIds))
        .all();
    await db.delete(workTag).where(inArray(workTag.workId, workIds));
    const tagIds = [...new Set(tagRows.map((row) => row.tagId))];
    if (tagIds.length > 0) {
        await db
            .update(tag)
            .set({ workCount: sql`max(0, ${tag.workCount} - 1)` })
            .where(inArray(tag.id, tagIds));
    }

    await db.delete(work).where(inArray(work.id, workIds));
}

export async function deleteWork(id: string) {
    await deleteWorkRows([id]);
}

export async function deleteComment(id: string) {
    await deleteCommentRows([id]);
}

export async function deleteTag(id: string) {
    await db.delete(workTag).where(eq(workTag.tagId, id));
    await db.delete(tag).where(eq(tag.id, id));
}

/**
 * 删除用户及其会话、账号、社交关系、消息、作品等全部关联数据。
 */
export async function deleteUser(id: string) {
    const convos = await db
        .select({ id: conversation.id })
        .from(conversation)
        .where(or(eq(conversation.user1Id, id), eq(conversation.user2Id, id)))
        .all();
    const convoIds = convos.map((convo) => convo.id);
    if (convoIds.length > 0) {
        await db
            .delete(message)
            .where(inArray(message.conversationId, convoIds));
        await db.delete(conversation).where(inArray(conversation.id, convoIds));
    }
    await db.delete(message).where(eq(message.senderId, id));

    await db.delete(session).where(eq(session.userId, id));
    await db.delete(account).where(eq(account.userId, id));
    await db
        .delete(follow)
        .where(or(eq(follow.followerId, id), eq(follow.followingId, id)));
    await db
        .delete(notification)
        .where(or(eq(notification.userId, id), eq(notification.actorId, id)));
    await db
        .delete(activity)
        .where(
            or(
                eq(activity.userId, id),
                eq(activity.actorId, id),
                eq(activity.targetUserId, id),
            ),
        );
    await db.delete(spark).where(eq(spark.userId, id));
    await db.delete(bookmark).where(eq(bookmark.userId, id));
    await db.delete(remix).where(eq(remix.userId, id));
    await db.delete(userAchievement).where(eq(userAchievement.userId, id));
    await db.delete(userSettings).where(eq(userSettings.userId, id));

    const ownComments = await db
        .select({ id: workComment.id })
        .from(workComment)
        .where(eq(workComment.userId, id))
        .all();
    await deleteCommentRows(ownComments.map((comment) => comment.id));

    const ownWorks = await db
        .select({ id: work.id })
        .from(work)
        .where(eq(work.userId, id))
        .all();
    await deleteWorkRows(ownWorks.map((row) => row.id));

    await db.delete(user).where(eq(user.id, id));
}
