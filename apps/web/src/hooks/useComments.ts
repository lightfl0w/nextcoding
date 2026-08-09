import useSWR from "swr";

export interface Comment {
    id: string;
    content: string;
    parentId: string | null;
    createdAt: string;
    author: { id: string | null; name: string | null };
}

async function fetcher(url: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`请求失败: ${res.status}`);
    return res.json();
}

export function useComments(workId: string) {
    return useSWR<Comment[]>(`/api/works/${workId}/comments`, fetcher);
}
