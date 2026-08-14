import useSWR from "swr";
import { fetchPopularTags, popularTagsPath, type Tag } from "~/lib/api/tags";

const EMPTY_TAGS: Tag[] = [];

export function usePopularTags(limit?: number) {
    const { data, isLoading, error } = useSWR<Tag[]>(
        popularTagsPath(limit),
        fetchPopularTags,
    );
    return { tags: data ?? EMPTY_TAGS, isLoading, error };
}
