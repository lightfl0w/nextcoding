export async function createWork(title: string): Promise<{ id: string }> {
    const form = new FormData();
    form.append("title", title);
    const res = await fetch("/api/works", { method: "POST", body: form });
    if (res.status === 401) throw new Error("请先登录");
    if (!res.ok) throw new Error(`创建失败: ${res.status}`);
    return res.json();
}
