import { Skeleton } from "@heroui/react";
import { memo } from "react";
import type { Tag } from "~/lib/api";
import { TagChip } from "./TagChip";

interface TagCloudProps {
    tags: Tag[];
    isLoading?: boolean;
}

const SKELETON_KEYS = Array.from(
    { length: 10 },
    (_, index) => `tag-skeleton-${index + 1}`,
);

/**
 * 标签云：根据作品数量展示不同大小的标签。
 * @param props.tags - 标签列表。
 * @param props.isLoading - 是否加载中。
 */
export const TagCloud = memo(function TagCloud({
    tags,
    isLoading,
}: TagCloudProps) {
    if (isLoading) {
        return (
            <div className="flex flex-wrap gap-2">
                {SKELETON_KEYS.map((key) => (
                    <Skeleton key={key} className="h-6 w-16 rounded-full" />
                ))}
            </div>
        );
    }

    if (!tags.length) {
        return null;
    }

    const maxCount = Math.max(...tags.map((t) => t.workCount), 1);

    return (
        <div className="flex flex-wrap gap-2 items-center">
            {tags.map((tag) => {
                const ratio = tag.workCount / maxCount;
                const sizeClass =
                    ratio > 0.7
                        ? "text-2xl"
                        : ratio > 0.4
                          ? "text-lg"
                          : ratio > 0.2
                            ? "text-base"
                            : "text-sm";

                return (
                    <span key={tag.id} className={sizeClass}>
                        <TagChip
                            name={tag.name}
                            slug={tag.slug}
                            color={tag.color ?? undefined}
                            size={sizeClass === "text-2xl" ? "md" : "sm"}
                        />
                    </span>
                );
            })}
        </div>
    );
});
