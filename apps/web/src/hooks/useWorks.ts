import useSWR from "swr";

export type Work = {
    id: string;
    title: string;
    description: string | null;
    coverUrl: string | null;
    tags: string[];
    views: number;
    likes: number;
    createdAt: number;
    author: { id: string | null; name: string | null };
};

export type WorkSort = "latest" | "popular";

async function fetcher(url: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`请求失败: ${res.status}`);
    return res.json();
}

export function useWorks(sort: WorkSort = "latest", limit = 20) {
    return useSWR<Work[]>(`/api/works?sort=${sort}&limit=${limit}`, fetcher);
}
