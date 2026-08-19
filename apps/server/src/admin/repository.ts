import {
    account,
    achievement,
    activity,
    bookmark,
    conversation,
    db,
    follow,
    message,
    notification,
    remix,
    report,
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
import { alias } from "drizzle-orm/sqlite-core";
import { detachAndRecomputeWorkTags } from "../tags/repository.js";

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
    await detachAndRecomputeWorkTags(id);
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

export interface AdminConversationFilters {
    search?: string;
    page: number;
    pageSize: number;
}

/**
 * 会话列表（管理员视角）：展示双方用户与消息概况，
 * 支持按参与者姓名/邮箱或消息内容关键词搜索，返回分页计数。
 */
export async function listAdminConversations(
    filters: AdminConversationFilters,
) {
    const user1 = alias(user, "user1");
    const user2 = alias(user, "user2");

    const conditions = [];
    if (filters.search) {
        const keyword = `%${escapeLike(filters.search)}%`;
        conditions.push(
            sql`(
                exists(
                    select 1 from ${user}
                    where ${user.id} = ${conversation.user1Id}
                      and (${user.name} like ${keyword} or ${user.email} like ${keyword})
                )
                or exists(
                    select 1 from ${user}
                    where ${user.id} = ${conversation.user2Id}
                      and (${user.name} like ${keyword} or ${user.email} like ${keyword})
                )
                or exists(
                    select 1 from ${message}
                    where ${message.conversationId} = ${conversation.id}
                      and ${message.content} like ${keyword}
                )
            )`,
        );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow, items] = await Promise.all([
        db
            .select({ value: count(conversation.id) })
            .from(conversation)
            .where(where)
            .get(),
        db
            .select({
                id: conversation.id,
                user1Id: conversation.user1Id,
                user1Name: user1.name,
                user1Image: user1.image,
                user1Email: user1.email,
                user2Id: conversation.user2Id,
                user2Name: user2.name,
                user2Image: user2.image,
                user2Email: user2.email,
                lastMessageAt: conversation.lastMessageAt,
                createdAt: conversation.createdAt,
                messageCount: sql<number>`(
                    select count(*) from ${message}
                    where ${message.conversationId} = ${conversation.id}
                )`,
                lastMessage: sql<string | null>`(
                    select ${message.content} from ${message}
                    where ${message.conversationId} = ${conversation.id}
                    order by ${message.createdAt} desc limit 1
                )`,
            })
            .from(conversation)
            .leftJoin(user1, eq(user1.id, conversation.user1Id))
            .leftJoin(user2, eq(user2.id, conversation.user2Id))
            .where(where)
            .orderBy(desc(conversation.lastMessageAt))
            .limit(filters.pageSize)
            .offset((filters.page - 1) * filters.pageSize)
            .all(),
    ]);

    return { total: totalRow?.value ?? 0, items };
}

export function findAdminConversationById(id: string) {
    return db
        .select({
            id: conversation.id,
            user1Id: conversation.user1Id,
            user2Id: conversation.user2Id,
        })
        .from(conversation)
        .where(eq(conversation.id, id))
        .get();
}

export function countAdminMessages(conversationId: string) {
    return db
        .select({ value: count(message.id) })
        .from(message)
        .where(eq(message.conversationId, conversationId))
        .get()
        .then((row) => row?.value ?? 0);
}

/**
 * 会话消息列表：按时间倒序返回，附带发送者信息。
 */
export function listAdminMessages(
    conversationId: string,
    limit: number,
    offset: number,
) {
    return db
        .select({
            id: message.id,
            conversationId: message.conversationId,
            senderId: message.senderId,
            content: message.content,
            read: message.read,
            createdAt: message.createdAt,
            senderName: user.name,
            senderImage: user.image,
        })
        .from(message)
        .leftJoin(user, eq(user.id, message.senderId))
        .where(eq(message.conversationId, conversationId))
        .orderBy(desc(message.createdAt))
        .limit(limit)
        .offset(offset);
}

export function findAdminMessageById(id: string) {
    return db
        .select({ id: message.id, content: message.content })
        .from(message)
        .where(eq(message.id, id))
        .get();
}

/**
 * 删除单条消息：清理引用它的通知，并刷新会话的最后消息时间。
 */
export async function deleteAdminMessage(id: string) {
    const row = await db
        .select({ conversationId: message.conversationId })
        .from(message)
        .where(eq(message.id, id))
        .get();
    if (!row) {
        return;
    }

    await db.delete(notification).where(eq(notification.messageId, id));
    await db.delete(message).where(eq(message.id, id));

    const last = await db
        .select({ createdAt: message.createdAt })
        .from(message)
        .where(eq(message.conversationId, row.conversationId))
        .orderBy(desc(message.createdAt))
        .limit(1)
        .get();
    await db
        .update(conversation)
        .set({ lastMessageAt: last?.createdAt ?? null })
        .where(eq(conversation.id, row.conversationId));
}

/**
 * 删除整个会话：连带清理其消息与相关通知。
 */
export async function deleteAdminConversation(id: string) {
    const rows = await db
        .select({ id: message.id })
        .from(message)
        .where(eq(message.conversationId, id))
        .all();
    const messageIds = rows.map((row) => row.id);
    if (messageIds.length > 0) {
        await db
            .delete(notification)
            .where(inArray(notification.messageId, messageIds));
    }
    await db.delete(message).where(eq(message.conversationId, id));
    await db.delete(conversation).where(eq(conversation.id, id));
}

export interface AdminReportFilters {
    status?: "pending" | "resolved" | "dismissed";
    page: number;
    pageSize: number;
}

/**
 * 举报列表（管理员视角）：展示作品、举报人与处理情况，支持按状态筛选。
 */
export async function listAdminReports(filters: AdminReportFilters) {
    const reporter = alias(user, "reporter");
    const handler = alias(user, "handler");

    const conditions = [];
    if (filters.status) {
        conditions.push(eq(report.status, filters.status));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow, items] = await Promise.all([
        db
            .select({ value: count(report.id) })
            .from(report)
            .where(where)
            .get(),
        db
            .select({
                id: report.id,
                reason: report.reason,
                status: report.status,
                handledAt: report.handledAt,
                createdAt: report.createdAt,
                workId: work.id,
                workTitle: work.title,
                workStatus: work.status,
                reporterId: report.reporterId,
                reporterName: reporter.name,
                handlerId: report.handledBy,
                handlerName: handler.name,
            })
            .from(report)
            .leftJoin(work, eq(work.id, report.workId))
            .leftJoin(reporter, eq(reporter.id, report.reporterId))
            .leftJoin(handler, eq(handler.id, report.handledBy))
            .where(where)
            .orderBy(desc(report.createdAt))
            .limit(filters.pageSize)
            .offset((filters.page - 1) * filters.pageSize)
            .all(),
    ]);

    return { total: totalRow?.value ?? 0, items };
}

export function findAdminReportById(id: string) {
    return db
        .select({ id: report.id, status: report.status })
        .from(report)
        .where(eq(report.id, id))
        .get();
}

/**
 * 处理/忽略举报：记录处理人与时间。
 */
export async function handleReport(
    id: string,
    status: "resolved" | "dismissed",
    adminId: string,
) {
    await db
        .update(report)
        .set({ status, handledBy: adminId, handledAt: new Date() })
        .where(eq(report.id, id));
}

export interface AdminAchievementRow {
    id: string;
    key: string;
    name: string;
    description: string;
    icon: string;
    category: string | null;
    threshold: number | null;
    createdAt: Date;
    unlockCount: number;
}

/**
 * 成就目录：全部成就及各自的解锁人数。
 */
export function listAdminAchievements() {
    return db
        .select({
            id: achievement.id,
            key: achievement.key,
            name: achievement.name,
            description: achievement.description,
            icon: achievement.icon,
            category: achievement.category,
            threshold: achievement.threshold,
            createdAt: achievement.createdAt,
            unlockCount: sql<number>`(
                select count(*) from user_achievement ua
                where ua.achievement_id = achievement.id
            )`,
        })
        .from(achievement)
        .orderBy(achievement.category, achievement.threshold);
}

export function findAchievementById(id: string) {
    return db
        .select({ id: achievement.id, name: achievement.name })
        .from(achievement)
        .where(eq(achievement.id, id))
        .get();
}

/**
 * 某用户已获得的成就列表。
 */
export function listAdminUserAchievements(userId: string) {
    return db
        .select({
            id: achievement.id,
            key: achievement.key,
            name: achievement.name,
            icon: achievement.icon,
            category: achievement.category,
            unlockedAt: userAchievement.unlockedAt,
        })
        .from(userAchievement)
        .innerJoin(
            achievement,
            eq(achievement.id, userAchievement.achievementId),
        )
        .where(eq(userAchievement.userId, userId))
        .orderBy(desc(userAchievement.unlockedAt));
}

/**
 * 授予成就：已获得时幂等返回。
 */
export async function grantAchievement(userId: string, achievementId: string) {
    const existing = await db
        .select({ id: userAchievement.id })
        .from(userAchievement)
        .where(
            and(
                eq(userAchievement.userId, userId),
                eq(userAchievement.achievementId, achievementId),
            ),
        )
        .get();
    if (existing) {
        return { granted: false };
    }
    await db.insert(userAchievement).values({
        id: crypto.randomUUID(),
        userId,
        achievementId,
        unlockedAt: new Date(),
    });
    return { granted: true };
}

/**
 * 撤销成就。
 */
export async function revokeAchievement(userId: string, achievementId: string) {
    await db
        .delete(userAchievement)
        .where(
            and(
                eq(userAchievement.userId, userId),
                eq(userAchievement.achievementId, achievementId),
            ),
        );
}
