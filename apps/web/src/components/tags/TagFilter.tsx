import { Chip } from "@heroui/react";
import { memo } from "react";
import type { Tag } from "~/lib/api";

interface TagFilterProps {
    tags: Tag[];
    selectedSlug?: string;
    onSelect: (slug: string | undefined) => void;
}

export const TagFilter = memo(function TagFilter({
    tags,
    selectedSlug,
    onSelect,
}: TagFilterProps) {
    return (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <Chip
                size="sm"
                variant={selectedSlug === undefined ? "primary" : "soft"}
                className="cursor-pointer shrink-0"
                onClick={() => onSelect(undefined)}
            >
                <Chip.Label>全部</Chip.Label>
            </Chip>
            {tags.map((tag) => (
                <Chip
                    key={tag.id}
                    size="sm"
                    variant={selectedSlug === tag.slug ? "primary" : "soft"}
                    className="cursor-pointer shrink-0"
                    onClick={() => onSelect(tag.slug)}
                >
                    <Chip.Label>{tag.name}</Chip.Label>
                </Chip>
            ))}
        </div>
    );
});
