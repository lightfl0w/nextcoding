import { getJson, mutateJson } from "./http";

export interface TemplateAuthor {
    id: string | null;
    name: string | null;
    image: string | null;
}

export interface Template {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    tags: string[];
    coverUrl: string | null;
    fileCount: number;
    useCount: number;
    rating: number;
    ratingCount: number;
    createdAt: string;
    authorId: string | null;
    authorName: string | null;
    authorImage: string | null;
}

export interface TemplateDetail extends Template {
    snapshotKey: string;
    derivedCount: number;
}

export interface TemplateUseRecord {
    id: string;
    createdAt: string;
    userId: string;
    userName: string | null;
    userImage: string | null;
    workId: string;
    workTitle: string;
    workStatus: "draft" | "published";
    workViews: number;
    workLikes: number;
    workSparks: number;
    commentCount: number;
}

export interface TemplateStats {
    works: number;
    likes: number;
    sparks: number;
    comments: number;
}

export interface TemplateStatsPanel {
    template: {
        id: string;
        title: string;
        useCount: number;
        rating: number;
        ratingCount: number;
    };
    uses: TemplateUseRecord[];
    totalUses: number;
    stats: TemplateStats;
}

export type TemplateSort = "hot" | "latest";

export function templatesPath(
    category?: string,
    sort?: TemplateSort,
    limit?: number,
) {
    const params = new URLSearchParams();
    if (category) {
        params.set("category", category);
    }
    if (sort) {
        params.set("sort", sort);
    }
    if (limit) {
        params.set("limit", String(limit));
    }
    const qs = params.toString();
    return `/api/templates${qs ? `?${qs}` : ""}`;
}

export function templatePath(id: string) {
    return `/api/templates/${id}`;
}

export function templateUsesPath(id: string, limit?: number) {
    const qs = limit ? `?limit=${limit}` : "";
    return `/api/templates/${id}/uses${qs}`;
}

export function templateTreePath(id: string) {
    return `/api/templates/${id}/tree`;
}

export function templateStatsPath(id: string) {
    return `/api/templates/${id}/stats`;
}

export function templateLeaderboardPath(limit?: number) {
    const qs = limit ? `?limit=${limit}` : "";
    return `/api/templates/leaderboard${qs}`;
}

export function workTemplatePath(workId: string) {
    return `/api/works/${workId}/template`;
}

export async function fetchTemplates(path: string): Promise<Template[]> {
    return getJson<Template[]>(path);
}

export async function fetchTemplate(path: string): Promise<TemplateDetail> {
    return getJson<TemplateDetail>(path);
}

export async function fetchTemplateTree(
    path: string,
): Promise<{ template: TemplateDetail; derived: TemplateUseRecord[] }> {
    return getJson(path);
}

export async function fetchTemplateStats(
    path: string,
): Promise<TemplateStatsPanel> {
    return getJson(path);
}

export async function fetchTemplateLeaderboard(
    path: string,
): Promise<Template[]> {
    return getJson(path);
}

export async function applyTemplate(id: string): Promise<{ id: string }> {
    return mutateJson<{ id: string }>(`/api/templates/${id}/use`, "POST");
}

export async function rateTemplate(
    id: string,
    score: number,
): Promise<{ ok: boolean; score: number }> {
    return mutateJson(`/api/templates/${id}/rate`, "POST", { score });
}

/**
 * 开启作品为模板。
 * @param workId - 作品 ID。
 * @param meta - 模板元信息（标题/描述/分类/封面，缺省取作品）。
 */
export async function enableWorkTemplate(
    workId: string,
    meta?: {
        title?: string;
        description?: string;
        category?: string;
        coverUrl?: string;
    },
): Promise<{ ok: boolean }> {
    return mutateJson(workTemplatePath(workId), "POST", meta ?? {});
}

/**
 * 关闭作品模板状态。
 * @param workId - 作品 ID。
 */
export async function disableWorkTemplate(
    workId: string,
): Promise<{ ok: boolean }> {
    return mutateJson(workTemplatePath(workId), "DELETE");
}
