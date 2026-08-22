import { getJson, HttpError, mutateJson, postForm } from "./http";

export interface NovelListItem {
    id: string;
    title: string;
    description: string | null;
    coverUrl: string | null;
    published: boolean;
    authorId: string;
    authorName: string | null;
    chapterCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface ChapterSummary {
    id: string;
    title: string;
    position: number;
    createdAt: string;
    updatedAt: string;
}

export interface ChapterDetail extends ChapterSummary {
    content: string;
}

export function novelsPath() {
    return "/api/novels";
}

export function novelPath(id: string) {
    return `/api/novels/${id}`;
}

export function chaptersPath(novelId: string) {
    return `/api/novels/${novelId}/chapters`;
}

export function chapterPath(novelId: string, chapterId: string) {
    return `/api/novels/${novelId}/chapters/${chapterId}`;
}

export function fetchNovels(path: string): Promise<NovelListItem[]> {
    return getJson<NovelListItem[]>(path);
}

export function fetchNovel(path: string): Promise<NovelListItem> {
    return getJson<NovelListItem>(path);
}

export function fetchChapters(path: string): Promise<ChapterSummary[]> {
    return getJson<ChapterSummary[]>(path);
}

export function fetchChapter(path: string): Promise<ChapterDetail> {
    return getJson<ChapterDetail>(path);
}

export function createNovel(title: string, description?: string) {
    return mutateJson<{ ok: true; id: string }>("/api/novels", "POST", {
        title,
        description: description ?? null,
    });
}

export function renameNovel(
    id: string,
    title: string,
    description?: string | null,
    coverUrl?: string | null,
) {
    return mutateJson<{ ok: true }>(novelPath(id), "PATCH", {
        title,
        description: description ?? null,
        coverUrl: coverUrl ?? null,
    });
}

export function publishNovel(
    id: string,
    values: {
        title: string;
        description?: string | null;
        coverUrl?: string | null;
    },
) {
    return mutateJson<{ ok: true }>(
        `${novelPath(id)}/publish`,
        "POST",
        {
            title: values.title,
            description: values.description ?? null,
            coverUrl: values.coverUrl ?? null,
        },
        "发布失败",
    );
}

export function unpublishNovel(id: string) {
    return mutateJson<{ ok: true }>(
        `${novelPath(id)}/unpublish`,
        "POST",
        undefined,
        "操作失败",
    );
}

export interface UploadedNovelCover {
    key: string;
    url: string;
}

/**
 * 上传小说封面（裁剪后的图片），返回公开访问地址。
 * @param file - 裁剪后的封面图片文件。
 */
export async function uploadNovelCover(
    file: File,
): Promise<UploadedNovelCover> {
    const form = new FormData();
    form.append("file", file);
    const response = await postForm("/api/novels/cover", form);
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
    return (await response.json()) as UploadedNovelCover;
}

export function deleteNovel(id: string) {
    return mutateJson<{ ok: true }>(
        novelPath(id),
        "DELETE",
        undefined,
        "删除小说失败",
    );
}

export function createChapter(novelId: string, title: string) {
    return mutateJson<{ ok: true; chapter: ChapterDetail }>(
        chaptersPath(novelId),
        "POST",
        { title },
        "新建章节失败",
    );
}

export function updateChapter(
    novelId: string,
    chapterId: string,
    values: { title: string; content?: string },
) {
    return mutateJson<{ ok: true }>(
        chapterPath(novelId, chapterId),
        "PATCH",
        values,
        "保存章节失败",
    );
}

export function deleteChapter(novelId: string, chapterId: string) {
    return mutateJson<{ ok: true }>(
        chapterPath(novelId, chapterId),
        "DELETE",
        undefined,
        "删除章节失败",
    );
}
