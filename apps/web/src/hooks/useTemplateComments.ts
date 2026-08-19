import useSWR from "swr";
import type { Comment, CommentSort } from "~/lib/api";
import {
    fetchTemplateComments,
    templateCommentsPath,
} from "~/lib/api/templates";

/**
 * 模板评论列表。
 * @param templateId - 模板 ID；为空时不请求。
 * @param sort - 排序方式：时间或受欢迎度。
 */
export function useTemplateComments(
    templateId: string | null,
    sort: CommentSort = "time",
) {
    const key = templateId
        ? `${templateCommentsPath(templateId)}?sort=${sort}`
        : null;
    return useSWR<Comment[]>(key, fetchTemplateComments);
}
