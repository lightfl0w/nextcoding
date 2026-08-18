/**
 * 模板分类（模板市场筛选项）。
 */
export const TEMPLATE_CATEGORIES = [
    { id: "frontend", label: "前端" },
    { id: "backend", label: "后端" },
    { id: "ai", label: "AI" },
    { id: "game", label: "游戏" },
    { id: "toolbox", label: "工具库" },
    { id: "fullstack", label: "全栈" },
] as const;

export type TemplateCategoryId = (typeof TEMPLATE_CATEGORIES)[number]["id"];

const LEGACY_CATEGORY_LABELS: Record<string, string> = {
    basic: "基础",
    web: "网页",
    algorithm: "算法",
    tool: "工具",
};

/**
 * 模板分类的中文标签；未知分类原样返回。
 * @param category - 分类 id；可能为 null。
 */
export function templateCategoryLabel(category: string | null): string {
    if (!category) {
        return "未分类";
    }
    const found = TEMPLATE_CATEGORIES.find((item) => item.id === category);
    if (found) {
        return found.label;
    }
    return LEGACY_CATEGORY_LABELS[category] ?? category;
}
