import useSWR from "swr";
import type { Comment } from "~/lib/api";
import {
    fetchTemplateComments,
    templateCommentsPath,
} from "~/lib/api/templates";

/**
 * 模板评论列表。
 * @param templateId - 模板 ID；为空时不请求。
 */
export function useTemplateComments(templateId: string | null) {
    return useSWR<Comment[]>(
        templateId ? templateCommentsPath(templateId) : null,
        fetchTemplateComments,
    );
}
