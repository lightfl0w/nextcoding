import useSWR from "swr";
import {
    fetchTemplateTree,
    type TemplateDetail,
    type TemplateUseRecord,
    templateTreePath,
} from "~/lib/api/templates";

interface TemplateTreeData {
    template: TemplateDetail | null;
    derived: TemplateUseRecord[];
}

const EMPTY_TREE: TemplateTreeData = { template: null, derived: [] };

/**
 * 模板派生树：模板及其派生作品。
 * @param id - 模板 ID；为空时不请求。
 */
export function useTemplateTree(id: string | null) {
    const { data, isLoading, error } = useSWR<TemplateTreeData>(
        id ? templateTreePath(id) : null,
        fetchTemplateTree,
    );
    return { tree: data ?? EMPTY_TREE, isLoading, error };
}
