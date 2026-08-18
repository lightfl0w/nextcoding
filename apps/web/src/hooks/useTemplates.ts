import useSWR from "swr";
import {
    fetchTemplates,
    type Template,
    type TemplateSort,
    templatesPath,
} from "~/lib/api/templates";

const EMPTY_TEMPLATES: Template[] = [];

/**
 * 模板市场列表。
 * @param category - 分类筛选。
 * @param sort - 排序方式（热度/最新）。
 */
export function useTemplates(category?: string, sort?: TemplateSort) {
    const { data, isLoading, error } = useSWR<Template[]>(
        templatesPath(category, sort),
        fetchTemplates,
    );
    return { templates: data ?? EMPTY_TEMPLATES, isLoading, error };
}
