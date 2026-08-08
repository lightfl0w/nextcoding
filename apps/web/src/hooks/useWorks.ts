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

async function fetcher(url: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`请求失败: ${res.status}`);
    return res.json();
}

export function useWorks() {
    return useSWR<Work[]>("/api/works", fetcher);
}
