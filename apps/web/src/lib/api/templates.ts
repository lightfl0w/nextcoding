import { getJson, HttpError, mutateJson, postForm } from "./http";
import type { Comment } from "./types";

export interface TemplateAuthor {
    id: string | null;
    name: string | null;
    image: string | null;
}

export type TemplateStatus = "pending" | "published" | "rejected";

export interface Template {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    tags: string[];
    coverUrl: string | null;
    status: TemplateStatus;
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

export function templateCommentsPath(id: string) {
    return `/api/templates/${id}/comments`;
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
    return getJson<Template[]>(path);
}

export function fetchTemplateComments(
    path: string,
): Promise<Comment[]> {
    return getJson<Comment[]>(path);
}

/**
 * 发表模板评论。
 * @param id - 模板 ID。
 * @param content - 评论内容。
 * @param parentId - 父评论 ID；顶级评论传 `null`。
 */
export function postTemplateComment(
    id: string,
    content: string,
    parentId: string | null,
): Promise<Comment> {
    return mutateJson<Comment>(
        templateCommentsPath(id),
        "POST",
        { content, parentId },
    );
}

export interface UploadedTemplateCover {
    key: string;
    url: string;
}

/**
 * 上传模板封面（裁剪后的图片）。
 * @param file - 裁剪后的封面图片文件。
 * @throws {@link HttpError} 请求失败时抛出。
 */
export async function uploadTemplateCover(
    file: File,
): Promise<UploadedTemplateCover> {
    const form = new FormData();
    form.append("file", file);
    const response = await postForm("/api/templates/cover", form);
    if (!response.ok) {
        let message = "封面上传失败";
        try {
            const body = (await response.json()) as { error?: string };
            if (body.error) {
                message = body.error;
            }
        } catch {}
        throw new HttpError(response.status, message);
    }
    return (await response.json()) as UploadedTemplateCover;
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

export interface TemplateFileInput {
    name: string;
    contentType?: string;
    content: string;
    isBase64?: boolean;
}

/**
 * 创建全新模板：提交元信息与文件内容，进入待审核状态。
 * @param values - 模板标题/描述/分类/标签/封面与文件列表。
 */
export async function createTemplate(values: {
    title: string;
    description?: string;
    category?: string;
    tags?: string[];
    coverUrl?: string;
    files: TemplateFileInput[];
}): Promise<{ ok: boolean; template: { id: string; status: TemplateStatus } }> {
    return mutateJson("/api/templates", "POST", values);
}
