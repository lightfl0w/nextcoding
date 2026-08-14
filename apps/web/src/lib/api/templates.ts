import { getJson, mutateJson } from "./http";

export interface Template {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    tags: string[];
    coverUrl: string | null;
    fileCount: number;
    useCount: number;
}

export interface TemplateDetail extends Template {
    snapshotKey: string;
}

export function templatesPath(category?: string, limit?: number) {
    const params = new URLSearchParams();
    if (category) {
        params.set("category", category);
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

export async function fetchTemplates(path: string): Promise<Template[]> {
    return getJson<Template[]>(path);
}

export async function fetchTemplate(path: string): Promise<TemplateDetail> {
    return getJson<TemplateDetail>(path);
}

export async function applyTemplate(id: string): Promise<{ id: string }> {
    return mutateJson<{ id: string }>(`/api/templates/${id}/use`, "POST");
}
