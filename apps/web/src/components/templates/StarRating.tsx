import { Star } from "lucide-react";
import { memo } from "react";

interface StarRatingProps {
    rating: number;
    size?: number;
    interactive?: boolean;
    value?: number;
    onRate?: (score: number) => void;
}

/**
 * 星级评分。非交互态只读展示平均分（rating 为平均分 ×10）；
 * 交互态点击 1-5 星打分。
 * @param props.rating - 平均分 ×10（0-50）。
 * @param props.size - 星星尺寸。
 * @param props.interactive - 是否可打分。
 * @param props.value - 交互态当前选中的分数。
 * @param props.onRate - 打分回调。
 */
export const StarRating = memo(function StarRating({
    rating,
    size = 14,
    interactive = false,
    value = 0,
    onRate,
}: StarRatingProps) {
    const score = Math.round(rating / 10);
    const selected = interactive ? value : score;

    return (
        <span className="inline-flex items-center gap-1">
            <span className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        aria-label={`${star} 星`}
                        disabled={!interactive}
                        onClick={
                            interactive && onRate
                                ? () => onRate(star)
                                : undefined
                        }
                        className={
                            interactive ? "cursor-pointer" : "cursor-default"
                        }
                    >
                        <Star
                            style={{ width: size, height: size }}
                            className={
                                star <= selected
                                    ? "text-amber-400 fill-amber-400"
                                    : "text-foreground/25"
                            }
                        />
                    </button>
                ))}
            </span>
            {!interactive && (
                <span className="text-xs text-foreground/55">
                    {(rating / 10).toFixed(1)}
                </span>
            )}
        </span>
    );
});
