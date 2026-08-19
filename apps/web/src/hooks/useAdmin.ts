import useSWR from "swr";
import {
    type AdminAchievement,
    type AdminComment,
    type AdminConversation,
    type AdminListQuery,
    type AdminMessage,
    type AdminReport,
    type AdminStats,
    type AdminTag,
    type AdminTemplate,
    type AdminUser,
    type AdminUserAchievement,
    type AdminWork,
    adminAchievementsPath,
    adminStatsPath,
    adminTagsPath,
    adminUserAchievementsPath,
    fetchAdminAchievements,
    fetchAdminComments,
    fetchAdminConversationMessages,
    fetchAdminConversations,
    fetchAdminReports,
    fetchAdminStats,
    fetchAdminTags,
    fetchAdminTemplates,
    fetchAdminUserAchievements,
    fetchAdminUsers,
    fetchAdminWorks,
    type PageResult,
} from "~/lib/api/admin";

export function useAdminStats() {
    return useSWR<AdminStats>(adminStatsPath(), fetchAdminStats);
}

export function useAdminUsers(query: AdminListQuery = {}) {
    return useSWR<PageResult<AdminUser>>(["/api/admin/users", query], ([, q]) =>
        fetchAdminUsers(q as AdminListQuery),
    );
}

export function useAdminWorks(query: AdminListQuery = {}) {
    return useSWR<PageResult<AdminWork>>(["/api/admin/works", query], ([, q]) =>
        fetchAdminWorks(q as AdminListQuery),
    );
}

export function useAdminComments(query: AdminListQuery = {}) {
    return useSWR<PageResult<AdminComment>>(
        ["/api/admin/comments", query],
        ([, q]) => fetchAdminComments(q as AdminListQuery),
    );
}

export function useAdminTags() {
    return useSWR<AdminTag[]>(adminTagsPath(), fetchAdminTags);
}

export function useAdminConversations(query: AdminListQuery = {}) {
    return useSWR<PageResult<AdminConversation>>(
        ["/api/admin/conversations", query],
        ([, q]) => fetchAdminConversations(q as AdminListQuery),
    );
}

export function useAdminConversationMessages(
    conversationId: string | undefined,
) {
    return useSWR<PageResult<AdminMessage>>(
        conversationId
            ? ["/api/admin/conversations", conversationId, "messages"]
            : null,
        () => fetchAdminConversationMessages(conversationId as string),
    );
}

export function useAdminReports(query: AdminListQuery = {}) {
    return useSWR<PageResult<AdminReport>>(
        ["/api/admin/reports", query],
        ([, q]) => fetchAdminReports(q as AdminListQuery),
    );
}

export function useAdminTemplates(query: AdminListQuery = {}) {
    return useSWR<PageResult<AdminTemplate>>(
        ["/api/admin/templates", query],
        ([, q]) => fetchAdminTemplates(q as AdminListQuery),
    );
}

export function useAdminAchievements() {
    return useSWR<AdminAchievement[]>(
        adminAchievementsPath(),
        fetchAdminAchievements,
    );
}

export function useAdminUserAchievements(userId: string | undefined) {
    return useSWR<AdminUserAchievement[]>(
        userId ? adminUserAchievementsPath(userId) : null,
        () => fetchAdminUserAchievements(userId as string),
    );
}
