import useSWR from "swr";
import {
    fetchTemplateLeaderboard,
    type Template,
    templateLeaderboardPath,
} from "~/lib/api/templates";

const EMPTY_LEADERBOARD: Template[] = [];

/**
 * 模板热度榜。
 * @param limit - 榜单条数。
 */
export function useTemplateLeaderboard(limit = 10) {
    const { data, isLoading } = useSWR<Template[]>(
        templateLeaderboardPath(limit),
        fetchTemplateLeaderboard,
    );
    return { templates: data ?? EMPTY_LEADERBOARD, isLoading };
}
