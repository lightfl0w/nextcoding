import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CommentsSection } from "../src/components/workDetail/CommentsSection";
import type { Comment } from "../src/lib/api";

vi.mock("@heroui/react", () => {
    function Card({ children }: { children: ReactNode }) {
        return <div>{children}</div>;
    }
    Card.Header = function CardHeader({ children }: { children: ReactNode }) {
        return <div>{children}</div>;
    };
    Card.Title = function CardTitle({ children }: { children: ReactNode }) {
        return <div>{children}</div>;
    };
    Card.Content = function CardContent({ children }: { children: ReactNode }) {
        return <div>{children}</div>;
    };
    return {
        Card,
        Skeleton: () => null,
        toast: { danger: () => {} },
    };
});

vi.mock("~/hooks/useAuth", () => ({
    useAuth: () => ({ isLoggedIn: true }),
}));

vi.mock("~/hooks/useCommentComposer", () => ({
    useCommentComposer: () => ({
        draft: "",
        isPosting: false,
        setDraft: () => {},
        submit: () => {},
    }),
}));

vi.mock("~/components/workDetail/CommentComposer", () => ({
    CommentComposer: () => null,
    SignInPrompt: () => null,
}));

vi.mock("~/components/workDetail/CommentRow", () => ({
    CommentRow: ({
        comment,
        isReply,
    }: {
        comment: { id: string };
        isReply?: boolean;
    }) => <div data-comment-id={comment.id} data-reply={isReply ? "1" : "0"} />,
}));

function makeComment(id: string, parentId: string | null): Comment {
    return {
        id,
        content: `content-${id}`,
        parentId,
        createdAt: "2026-01-01T00:00:00Z",
        author: { id: "u1", name: "张三", image: null, bio: null },
    };
}

function countOf(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1;
}

describe("CommentsSection 折叠行为", () => {
    function render(comments: Comment[]) {
        return renderToStaticMarkup(
            <CommentsSection
                workId="w1"
                comments={comments}
                isLoading={false}
                mutate={async () => []}
            />,
        );
    }

    it("顶层评论全部展示，不折叠", () => {
        const html = render([
            makeComment("c1", null),
            makeComment("c2", null),
            makeComment("c3", null),
        ]);
        expect(countOf(html, 'data-comment-id="c1"')).toBe(1);
        expect(countOf(html, 'data-comment-id="c2"')).toBe(1);
        expect(countOf(html, 'data-comment-id="c3"')).toBe(1);
        expect(html).not.toContain("展开全部");
    });

    it("回复超过 3 条时折叠为前 3 条，显示展开按钮", () => {
        const comments = [makeComment("c1", null)];
        for (let i = 1; i <= 5; i++) {
            comments.push(makeComment(`r${i}`, "c1"));
        }
        const html = render(comments);
        expect(countOf(html, 'data-comment-id="c1"')).toBe(1);
        expect(countOf(html, 'data-reply="1"')).toBe(3);
        expect(html).toContain("展开全部 5 条回复");
        expect(html).not.toContain('data-comment-id="r4"');
        expect(html).not.toContain('data-comment-id="r5"');
    });

    it("回复不超过 3 条时全部展示，无展开按钮", () => {
        const html = render([
            makeComment("c1", null),
            makeComment("r1", "c1"),
            makeComment("r2", "c1"),
        ]);
        expect(countOf(html, 'data-reply="1"')).toBe(2);
        expect(html).not.toContain("展开全部");
    });

    it("更深层级的回复计入折叠总数", () => {
        const comments = [
            makeComment("c1", null),
            makeComment("r1", "c1"),
            makeComment("d1", "r1"),
            makeComment("d2", "r1"),
            makeComment("d3", "r1"),
            makeComment("d4", "r1"),
        ];
        const html = render(comments);
        // 子评论(1 条) + 子子评论(4 条) = 5 条 > 3，折叠后只展示直接回复 r1
        expect(countOf(html, 'data-comment-id="c1"')).toBe(1);
        expect(countOf(html, 'data-reply="1"')).toBe(1);
        expect(html).toContain("展开全部 5 条回复");
        expect(html).not.toContain('data-comment-id="d1"');
        expect(html).not.toContain('data-comment-id="d4"');
    });

    it("子评论与子子评论合并计数，超过 3 条即折叠", () => {
        const comments = [
            makeComment("c1", null),
            makeComment("r1", "c1"),
            makeComment("d1", "r1"),
            makeComment("d2", "r1"),
            makeComment("d3", "r1"),
        ];
        const html = render(comments);
        // 1 条直接回复 + 3 条子子回复 = 4 条 > 3，折叠后只展示 r1
        expect(countOf(html, 'data-reply="1"')).toBe(1);
        expect(html).toContain("展开全部 4 条回复");
        expect(html).not.toContain('data-comment-id="d1"');
    });

    it("子评论与子子评论总数不超过 3 条时全部展示", () => {
        const html = render([
            makeComment("c1", null),
            makeComment("r1", "c1"),
            makeComment("d1", "r1"),
            makeComment("d2", "r1"),
        ]);
        // 1 + 2 = 3 条，不超过阈值，完整展示
        expect(countOf(html, 'data-reply="1"')).toBe(3);
        expect(html).not.toContain("展开全部");
    });
});
