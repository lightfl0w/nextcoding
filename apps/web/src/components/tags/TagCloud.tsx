import { Skeleton, Tag, TagGroup } from "@heroui/react";
import { memo } from "react";
import type { Tag as TagInfo } from "~/lib/api";

interface TagCloudProps {
    tags: TagInfo[];
    isLoading?: boolean;
    selectedSlug?: string | null;
    onSelect?: (slug: string | null) => void;
}

const SKELETON_KEYS = Array.from(
    { length: 10 },
    (_, index) => `tag-skeleton-${index + 1}`,
);

/**
 * 标签云
 * 点击某个标签会把其 slug 通过 onSelect 回调上抛，由父页面在下方展示作品。
 * @param props.tags - 标签列表。
 * @param props.isLoading - 是否加载中。
 * @param props.selectedSlug - 当前选中的标签 slug。
 * @param props.onSelect - 选中变化回调（取消选中时传 null）。
 */
export const TagCloud = memo(function TagCloud({
    tags,
    isLoading,
    selectedSlug,
    onSelect,
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

    return (
        <TagGroup
            aria-label="标签"
            selectionMode="single"
            selectedKeys={selectedSlug ? [selectedSlug] : []}
            onSelectionChange={(keys) => {
                const next =
                    keys === "all"
                        ? null
                        : ((Array.from(keys)[0] as string | undefined) ?? null);
                onSelect?.(next);
            }}
        >
            <TagGroup.List items={tags}>
                {(tag) => (
                    <Tag id={tag.slug} textValue={tag.name}>
                        {tag.name}
                    </Tag>
                )}
            </TagGroup.List>
        </TagGroup>
    );
});
