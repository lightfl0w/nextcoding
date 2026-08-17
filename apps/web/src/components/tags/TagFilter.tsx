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
            <button
                type="button"
                onClick={() => onSelect(undefined)}
                className="shrink-0"
            >
                <Chip
                    size="sm"
                    variant={selectedSlug === undefined ? "primary" : "soft"}
                    className="cursor-pointer"
                >
                    <Chip.Label>全部</Chip.Label>
                </Chip>
            </button>
            {tags.map((tag) => (
                <button
                    key={tag.id}
                    type="button"
                    onClick={() => onSelect(tag.slug)}
                    className="shrink-0"
                >
                    <Chip
                        size="sm"
                        variant={selectedSlug === tag.slug ? "primary" : "soft"}
                        className="cursor-pointer"
                    >
                        <Chip.Label>{tag.name}</Chip.Label>
                    </Chip>
                </button>
            ))}
        </div>
    );
});
