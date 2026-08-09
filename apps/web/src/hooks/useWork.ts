import useSWR from "swr";
import type { Work } from "~/hooks/useWorks";

export interface WorkFile {
    id: string;
    key: string;
    name: string;
    size: number;
    contentType: string | null;
    version: number;
    createdAt: string;
}

export type WorkDetail = Work & {
    userId: string;
    status: "draft" | "published";
    files: WorkFile[];
};

async function fetcher(url: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`请求失败: ${res.status}`);
    return res.json();
}

export function useWork(id: string) {
    return useSWR<WorkDetail>(`/api/works/${id}`, fetcher);
}
