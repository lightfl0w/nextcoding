import { getJson, mutateJson } from "./http";

export interface AdminStats {
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
        createdAt: string;
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

export interface AdminUser {
    id: string;
    name: string;
    email: string;
    image: string | null;
    bio: string | null;
    role: string | null;
    banned: boolean;
    banReason: string | null;
    banExpires: string | null;
    emailVerified: boolean;
    createdAt: string;
    updatedAt: string;
    workCount: number;
}

export interface AdminWork {
    id: string;
    title: string;
    status: "draft" | "published";
    views: number;
    likes: number;
    sparks: number;
    createdAt: string;
    updatedAt: string;
    authorId: string;
    authorName: string;
}

export interface AdminComment {
    id: string;
    content: string;
    parentId: string | null;
    createdAt: string;
    workId: string;
    workTitle: string;
    authorId: string;
    authorName: string;
    authorImage: string | null;
}

export interface AdminTag {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    color: string | null;
    workCount: number;
    createdAt: string;
}

export interface PageResult<T> {
    total: number;
    items: T[];
}

export interface AdminListQuery {
    search?: string;
    role?: "admin" | "user";
    banned?: boolean;
    status?:
        | "draft"
        | "published"
        | "pending"
        | "resolved"
        | "dismissed"
        | "rejected";
    page?: number;
    pageSize?: number;
}

function adminListPath(
    resource:
        | "users"
        | "works"
        | "comments"
        | "conversations"
        | "reports"
        | "templates",
    query: AdminListQuery = {},
) {
    const params = new URLSearchParams();
    if (query.search) {
        params.set("search", query.search);
    }
    if (query.role) {
        params.set("role", query.role);
    }
    if (query.banned !== undefined) {
        params.set("banned", String(query.banned));
    }
    if (query.status) {
        params.set("status", query.status);
    }
    if (query.page && query.page > 1) {
        params.set("page", String(query.page));
    }
    if (query.pageSize && query.pageSize !== 20) {
        params.set("pageSize", String(query.pageSize));
    }
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    return `/api/admin/${resource}${suffix}`;
}

export function adminStatsPath(): string {
    return "/api/admin/stats";
}

export function adminTagsPath(): string {
    return "/api/admin/tags";
}

export function fetchAdminStats(): Promise<AdminStats> {
    return getJson<AdminStats>(adminStatsPath());
}

export function fetchAdminUsers(
    query: AdminListQuery = {},
): Promise<PageResult<AdminUser>> {
    return getJson<PageResult<AdminUser>>(adminListPath("users", query));
}

export function fetchAdminWorks(
    query: AdminListQuery = {},
): Promise<PageResult<AdminWork>> {
    return getJson<PageResult<AdminWork>>(adminListPath("works", query));
}

export function fetchAdminComments(
    query: AdminListQuery = {},
): Promise<PageResult<AdminComment>> {
    return getJson<PageResult<AdminComment>>(adminListPath("comments", query));
}

export function fetchAdminTags(): Promise<AdminTag[]> {
    return getJson<AdminTag[]>(adminTagsPath());
}

function userActionPath(userId: string, action = "") {
    return `/api/admin/users/${userId}${action}`;
}

export function setAdminUserRole(userId: string, role: "admin" | "user") {
    return mutateJson<{ id: string; role: "admin" | "user" }>(
        userActionPath(userId, "/role"),
        "PATCH",
        { role },
        "修改角色失败",
    );
}

export interface BanResult {
    id: string;
    banned: boolean;
    banReason: string | null;
    banExpires: string | null;
}

export function banAdminUser(userId: string, reason: string, hours?: number) {
    return mutateJson<BanResult>(
        userActionPath(userId, "/ban"),
        "POST",
        { reason, hours },
        "封禁失败",
    );
}

export function unbanAdminUser(userId: string) {
    return mutateJson<{ id: string; banned: boolean }>(
        userActionPath(userId, "/ban"),
        "DELETE",
        undefined,
        "解封失败",
    );
}

export function deleteAdminUser(userId: string) {
    return mutateJson<{ ok: boolean; id: string }>(
        userActionPath(userId),
        "DELETE",
        undefined,
        "删除用户失败",
    );
}

export function deleteAdminWork(workId: string) {
    return mutateJson<{ ok: boolean; id: string }>(
        `/api/admin/works/${workId}`,
        "DELETE",
        undefined,
        "删除作品失败",
    );
}

export function deleteAdminComment(commentId: string) {
    return mutateJson<{ ok: boolean; id: string }>(
        `/api/admin/comments/${commentId}`,
        "DELETE",
        undefined,
        "删除评论失败",
    );
}

export function deleteAdminTag(tagId: string) {
    return mutateJson<{ ok: boolean; id: string }>(
        `/api/admin/tags/${tagId}`,
        "DELETE",
        undefined,
        "删除标签失败",
    );
}

export interface AdminConversationUser {
    id: string;
    name: string | null;
    image: string | null;
    email: string | null;
}

export interface AdminConversation {
    id: string;
    user1: AdminConversationUser;
    user2: AdminConversationUser;
    messageCount: number;
    lastMessage: string | null;
    lastMessageAt: string | null;
    createdAt: string;
}

export interface AdminMessage {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    read: boolean;
    createdAt: string;
    sender: { id: string; name: string | null; image: string | null };
}

const ADMIN_MESSAGE_LIMIT = 200;

export function adminConversationsPath(query: AdminListQuery = {}) {
    return adminListPath("conversations", query);
}

export function adminConversationMessagesPath(
    conversationId: string,
    limit: number = ADMIN_MESSAGE_LIMIT,
) {
    return `/api/admin/conversations/${conversationId}/messages?limit=${limit}`;
}

export function fetchAdminConversations(
    query: AdminListQuery = {},
): Promise<PageResult<AdminConversation>> {
    return getJson<PageResult<AdminConversation>>(
        adminConversationsPath(query),
    );
}

export function fetchAdminConversationMessages(
    conversationId: string,
): Promise<PageResult<AdminMessage>> {
    return getJson<PageResult<AdminMessage>>(
        adminConversationMessagesPath(conversationId),
    );
}

export function deleteAdminMessage(messageId: string) {
    return mutateJson<{ ok: boolean; id: string }>(
        `/api/admin/messages/${messageId}`,
        "DELETE",
        undefined,
        "删除消息失败",
    );
}

export function deleteAdminConversation(conversationId: string) {
    return mutateJson<{ ok: boolean; id: string }>(
        `/api/admin/conversations/${conversationId}`,
        "DELETE",
        undefined,
        "删除会话失败",
    );
}

export type AdminReportStatus = "pending" | "resolved" | "dismissed";

export interface AdminReport {
    id: string;
    reason: string;
    status: AdminReportStatus;
    handledAt: string | null;
    createdAt: string;
    workId: string;
    workTitle: string;
    workStatus: "draft" | "published";
    reporterId: string;
    reporterName: string | null;
    handlerId: string | null;
    handlerName: string | null;
}

export function fetchAdminReports(
    query: AdminListQuery = {},
): Promise<PageResult<AdminReport>> {
    return getJson<PageResult<AdminReport>>(adminListPath("reports", query));
}

export function resolveAdminReport(reportId: string) {
    return mutateJson<{ ok: boolean; id: string; status: AdminReportStatus }>(
        `/api/admin/reports/${reportId}/resolve`,
        "POST",
        undefined,
        "处理举报失败",
    );
}

export function dismissAdminReport(reportId: string) {
    return mutateJson<{ ok: boolean; id: string; status: AdminReportStatus }>(
        `/api/admin/reports/${reportId}/dismiss`,
        "POST",
        undefined,
        "忽略举报失败",
    );
}

export type AdminTemplateStatus = "pending" | "published" | "rejected";

export interface AdminTemplate {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    tags: string;
    coverUrl: string | null;
    status: AdminTemplateStatus;
    fileCount: number;
    useCount: number;
    rating: number;
    ratingCount: number;
    createdAt: string;
    updatedAt: string;
    authorId: string | null;
    authorName: string | null;
    authorImage: string | null;
    reviewedAt: string | null;
    derivedCount: number;
}

export function fetchAdminTemplates(
    query: AdminListQuery = {},
): Promise<PageResult<AdminTemplate>> {
    return getJson<PageResult<AdminTemplate>>(
        adminListPath("templates", query),
    );
}

export function approveAdminTemplate(templateId: string) {
    return mutateJson<{
        ok: boolean;
        id: string;
        status: AdminTemplateStatus;
    }>(
        `/api/admin/templates/${templateId}/approve`,
        "POST",
        undefined,
        "通过模板失败",
    );
}

export function rejectAdminTemplate(templateId: string) {
    return mutateJson<{
        ok: boolean;
        id: string;
        status: AdminTemplateStatus;
    }>(
        `/api/admin/templates/${templateId}/reject`,
        "POST",
        undefined,
        "驳回模板失败",
    );
}

export function deleteAdminTemplate(templateId: string) {
    return mutateJson<{ ok: boolean; id: string }>(
        `/api/admin/templates/${templateId}`,
        "DELETE",
        undefined,
        "删除模板失败",
    );
}

export interface AdminAchievement {
    id: string;
    key: string;
    name: string;
    description: string;
    icon: string;
    category: string | null;
    threshold: number | null;
    createdAt: string;
    unlockCount: number;
}

export interface AdminUserAchievement {
    id: string;
    key: string;
    name: string;
    icon: string;
    category: string | null;
    unlockedAt: string;
}

export function adminAchievementsPath(): string {
    return "/api/admin/achievements";
}

export function adminUserAchievementsPath(userId: string): string {
    return `/api/admin/achievements/users/${userId}`;
}

export function fetchAdminAchievements(): Promise<AdminAchievement[]> {
    return getJson<AdminAchievement[]>(adminAchievementsPath());
}

export function fetchAdminUserAchievements(
    userId: string,
): Promise<AdminUserAchievement[]> {
    return getJson<AdminUserAchievement[]>(adminUserAchievementsPath(userId));
}

export function grantAdminAchievement(userId: string, achievementId: string) {
    return mutateJson<{ ok: boolean; granted: boolean }>(
        "/api/admin/achievements/grant",
        "POST",
        { userId, achievementId },
        "授予成就失败",
    );
}

export function revokeAdminAchievement(userId: string, achievementId: string) {
    return mutateJson<{ ok: boolean }>(
        "/api/admin/achievements/revoke",
        "POST",
        { userId, achievementId },
        "撤销成就失败",
    );
}
