import useSWR from "swr";
import {
    fetchTemplate,
    type TemplateDetail,
    templatePath,
} from "~/lib/api/templates";

/**
 * 模板详情。
 * @param id - 模板 ID；为空时不请求。
 */
export function useTemplate(id: string | null) {
    const { data, isLoading, error, mutate } = useSWR<TemplateDetail>(
        id ? templatePath(id) : null,
        fetchTemplate,
    );
    return { template: data, isLoading, error, mutate };
}
