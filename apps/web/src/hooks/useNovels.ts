import useSWR from "swr";
import {
    type ChapterDetail,
    type ChapterSummary,
    chapterPath,
    chaptersPath,
    fetchChapter,
    fetchChapters,
    fetchNovel,
    fetchNovels,
    type NovelListItem,
    novelPath,
    novelsPath,
} from "~/lib/api/novels";

const EMPTY_NOVELS: NovelListItem[] = [];
const EMPTY_CHAPTERS: ChapterSummary[] = [];

export function useNovels() {
    const { data, isLoading, error, mutate } = useSWR<NovelListItem[]>(
        novelsPath(),
        fetchNovels,
    );
    return {
        novels: data ?? EMPTY_NOVELS,
        isLoading,
        error,
        mutate,
    };
}

export function useNovel(id: string | undefined) {
    const { data, isLoading, error, mutate } = useSWR<NovelListItem>(
        id ? novelPath(id) : null,
        fetchNovel,
    );
    return { novel: data, isLoading, error, mutate };
}

export function useChapters(novelId: string | undefined) {
    const { data, isLoading, error, mutate } = useSWR<ChapterSummary[]>(
        novelId ? chaptersPath(novelId) : null,
        fetchChapters,
    );
    return {
        chapters: data ?? EMPTY_CHAPTERS,
        isLoading,
        error,
        mutate,
    };
}

export function useChapter(
    novelId: string | undefined,
    chapterId: string | null,
) {
    const { data, isLoading, error } = useSWR<ChapterDetail>(
        novelId && chapterId ? chapterPath(novelId, chapterId) : null,
        fetchChapter,
    );
    return { chapter: data, isLoading, error };
}
