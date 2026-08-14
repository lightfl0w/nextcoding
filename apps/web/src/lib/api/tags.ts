import { getJson } from "./http";
import type { Work } from "./types";

export interface Tag {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    color: string | null;
    workCount: number;
}

export interface TagDetail extends Tag {
    works: Work[];
}

export function tagsPath(keyword?: string, sort?: string, limit?: number) {
    const params = new URLSearchParams();
    if (keyword) {
        params.set("keyword", keyword);
    }
    if (sort) {
        params.set("sort", sort);
    }
    if (limit) {
        params.set("limit", String(limit));
    }
    const qs = params.toString();
    return `/api/tags${qs ? `?${qs}` : ""}`;
}

export function popularTagsPath(limit?: number) {
    return `/api/tags/popular${limit ? `?limit=${limit}` : ""}`;
}

export function tagDetailPath(slug: string, sort?: string, limit?: number) {
    const params = new URLSearchParams();
    if (sort) {
        params.set("sort", sort);
    }
    if (limit) {
        params.set("limit", String(limit));
    }
    const qs = params.toString();
    return `/api/tags/${slug}${qs ? `?${qs}` : ""}`;
}

export async function fetchTags(path: string): Promise<Tag[]> {
    return getJson<Tag[]>(path);
}

export async function fetchPopularTags(path: string): Promise<Tag[]> {
    return getJson<Tag[]>(path);
}

export async function fetchTagDetail(path: string): Promise<TagDetail> {
    return getJson<TagDetail>(path);
}
