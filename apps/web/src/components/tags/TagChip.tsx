import { Chip } from "@heroui/react";
import { Link } from "@tanstack/react-router";

interface TagChipProps {
    name: string;
    slug: string;
    color?: string;
    size?: "sm" | "md";
}

/**
 * 可点击标签，点击跳转到标签详情页。
 * @param props.name - 标签名。
 * @param props.slug - 标签 slug。
 * @param props.color - 可选颜色。
 * @param props.size - 尺寸，默认 sm。
 */
export function TagChip({ name, slug, color, size = "sm" }: TagChipProps) {
    return (
        <Link to="/tags/$slug" params={{ slug }} className="block">
            <Chip
                size={size}
                variant="soft"
                color={color ? undefined : "default"}
                style={
                    color ? { backgroundColor: `${color}20`, color } : undefined
                }
            >
                <Chip.Label>{name}</Chip.Label>
            </Chip>
        </Link>
    );
}
