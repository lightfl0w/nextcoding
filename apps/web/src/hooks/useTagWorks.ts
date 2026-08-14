import useSWR from "swr";
import { fetchTagDetail, type TagDetail, tagDetailPath } from "~/lib/api/tags";

export function useTagWorks(slug: string | undefined, sort?: string) {
    const path = slug ? tagDetailPath(slug, sort) : null;
    return useSWR<TagDetail>(path, fetchTagDetail);
}
