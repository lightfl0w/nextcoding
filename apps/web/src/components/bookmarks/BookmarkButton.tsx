import { Button, Spinner } from "@heroui/react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useBookmark } from "~/hooks/useBookmark";

interface BookmarkButtonProps {
    workId: string;
}

/**
 * 收藏切换按钮。
 * @param props.workId - 作品 ID。
 */
export function BookmarkButton({ workId }: BookmarkButtonProps) {
    const { bookmarked, pending, toggle } = useBookmark(workId);

    return (
        <Button
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={toggle}
            isDisabled={pending}
            aria-label={bookmarked ? "取消收藏" : "收藏"}
        >
            {pending ? (
                <Spinner size="sm" />
            ) : bookmarked ? (
                <BookmarkCheck
                    className="size-4 text-primary"
                    fill="currentColor"
                />
            ) : (
                <Bookmark className="size-4 text-foreground/60" />
            )}
        </Button>
    );
}
