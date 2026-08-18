import useSWR from "swr";
import {
    fetchTemplateStats,
    type TemplateStatsPanel,
    templateStatsPath,
} from "~/lib/api/templates";

/**
 * 模板使用数据面板（仅模板作者有权限）。
 * @param id - 模板 ID；为空时不请求。
 */
export function useTemplateStats(id: string | null) {
    const { data, isLoading, error } = useSWR<TemplateStatsPanel>(
        id ? templateStatsPath(id) : null,
        fetchTemplateStats,
    );
    return { stats: data, isLoading, error };
}
