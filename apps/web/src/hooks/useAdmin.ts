import useSWR from "swr";
import {
    type AdminComment,
    type AdminListQuery,
    type AdminStats,
    type AdminTag,
    type AdminUser,
    type AdminWork,
    adminStatsPath,
    adminTagsPath,
    fetchAdminComments,
    fetchAdminStats,
    fetchAdminTags,
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
