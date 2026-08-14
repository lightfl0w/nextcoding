import useSWR from "swr";
import {
    fetchTemplates,
    type Template,
    templatesPath,
} from "~/lib/api/templates";

const EMPTY_TEMPLATES: Template[] = [];

export function useTemplates(category?: string) {
    const { data, isLoading, error } = useSWR<Template[]>(
        templatesPath(category),
        fetchTemplates,
    );
    return { templates: data ?? EMPTY_TEMPLATES, isLoading, error };
}
