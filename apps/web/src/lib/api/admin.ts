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
    status?: "draft" | "published";
    page?: number;
    pageSize?: number;
}

function adminListPath(
    resource: "users" | "works" | "comments",
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
