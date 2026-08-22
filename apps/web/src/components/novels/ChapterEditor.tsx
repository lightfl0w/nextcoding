import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, type Editor, useEditor } from "@tiptap/react";
import type { ReactNode } from "react";
import { Fragment, useRef } from "react";

interface ChapterEditorProps {
    /** 初始 HTML（切换章节时父组件通过 key 重新挂载本组件）。 */
    initialContent: string;
    /** 内容变化时回调（Tiptap 生成的 HTML 片段）。 */
    onChange: (html: string) => void;
    editable?: boolean;
}

interface FormatTool {
    id: string;
    label: string;
    text: ReactNode;
    /** 是否为某一逻辑分组的起点（用于插入分隔线）。 */
    groupStart?: boolean;
    active: (editor: Editor | null) => boolean;
    run: (editor: Editor | null) => void;
}

const FORMAT_TOOLS: FormatTool[] = [
    {
        id: "bold",
        label: "加粗",
        text: <span className="font-bold">B</span>,
        active: (e) => !!e?.isActive("bold"),
        run: (e) => e?.chain().focus().toggleBold().run(),
    },
    {
        id: "italic",
        label: "斜体",
        text: <span className="italic">I</span>,
        active: (e) => !!e?.isActive("italic"),
        run: (e) => e?.chain().focus().toggleItalic().run(),
    },
    {
        id: "h1",
        label: "一级标题",
        text: "H1",
        groupStart: true,
        active: (e) => !!e?.isActive("heading", { level: 1 }),
        run: (e) => e?.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
        id: "h2",
        label: "二级标题",
        text: "H2",
        active: (e) => !!e?.isActive("heading", { level: 2 }),
        run: (e) => e?.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
        id: "paragraph",
        label: "正文",
        text: "¶",
        active: (e) => !!e?.isActive("paragraph"),
        run: (e) => e?.chain().focus().setParagraph().run(),
    },
    {
        id: "bulletList",
        label: "无序列表",
        text: "•",
        groupStart: true,
        active: (e) => !!e?.isActive("bulletList"),
        run: (e) => e?.chain().focus().toggleBulletList().run(),
    },
    {
        id: "orderedList",
        label: "有序列表",
        text: "1.",
        active: (e) => !!e?.isActive("orderedList"),
        run: (e) => e?.chain().focus().toggleOrderedList().run(),
    },
    {
        id: "blockquote",
        label: "引用",
        text: "❝",
        active: (e) => !!e?.isActive("blockquote"),
        run: (e) => e?.chain().focus().toggleBlockquote().run(),
    },
];

const EDITOR_CSS = `
.chapter-prose:focus { outline: none; }
.chapter-prose { line-height: 1.85; font-size: 1rem; }
.chapter-prose h1 { font-size: 1.6rem; font-weight: 700; margin: 1.1rem 0 .5rem; }
.chapter-prose h2 { font-size: 1.3rem; font-weight: 700; margin: 1rem 0 .4rem; }
.chapter-prose h3 { font-size: 1.1rem; font-weight: 600; margin: .8rem 0 .4rem; }
.chapter-prose p { margin: .6rem 0; }
.chapter-prose ul { list-style: disc; padding-left: 1.6rem; margin: .6rem 0; }
.chapter-prose ol { list-style: decimal; padding-left: 1.6rem; margin: .6rem 0; }
.chapter-prose blockquote { border-left: 3px solid currentColor; padding-left: 1rem; opacity: .75; margin: .8rem 0; }
.chapter-prose hr { border: none; border-top: 1px solid rgba(128,128,128,.4); margin: 1.2rem 0; }
.chapter-prose pre { background: rgba(128,128,128,.12); padding: .8rem; border-radius: .5rem; overflow: auto; }
.chapter-prose code { background: rgba(128,128,128,.16); padding: .1rem .3rem; border-radius: .25rem; font-size: .9em; }
.chapter-prose img { max-width: 100%; border-radius: .5rem; }
`;

export function ChapterEditor({
    initialContent,
    onChange,
    editable = true,
}: ChapterEditorProps) {
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const editor = useEditor({
        extensions: [StarterKit],
        content: initialContent,
        editable,
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: "chapter-prose px-5 py-4 min-h-[60vh]",
            },
        },
        onUpdate: ({ editor }) => {
            onChangeRef.current(editor.getHTML());
        },
    });

    // 选中态由编辑器实时 marks 派生；点击时按「与当前显示态的差异」驱动对应命令，
    // 这样光标移动导致的样式变化不会误触发命令。
    const selectedKeys = new Set(
        FORMAT_TOOLS.filter((tool) => tool.active(editor)).map(
            (tool) => tool.id,
        ),
    );
    const selectedKeysRef = useRef(selectedKeys);
    selectedKeysRef.current = selectedKeys;

    const handleSelectionChange = (keys: Set<string>) => {
        for (const tool of FORMAT_TOOLS) {
            const now = keys.has(tool.id);
            const was = selectedKeysRef.current.has(tool.id);
            if (now !== was) {
                tool.run(editor);
            }
        }
    };

    return (
        <div className="flex h-full flex-col">
            <style>{EDITOR_CSS}</style>
            {editable && (
                <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-default-200/70 bg-surface px-3 py-2">
                    <ToggleButtonGroup
                        selectionMode="multiple"
                        selectedKeys={selectedKeys}
                        onSelectionChange={(keys) =>
                            handleSelectionChange(keys as Set<string>)
                        }
                        size="sm"
                        aria-label="文本格式"
                    >
                        {FORMAT_TOOLS.map((tool) => (
                            <Fragment key={tool.id}>
                                {tool.groupStart && (
                                    <ToggleButtonGroup.Separator />
                                )}
                                <ToggleButton id={tool.id} aria-label={tool.label}>
                                    {tool.text}
                                </ToggleButton>
                            </Fragment>
                        ))}
                    </ToggleButtonGroup>

                    <div className="mx-1 h-6 w-px bg-default-200" />
                    <Button
                        size="sm"
                        variant="ghost"
                        isIconOnly
                        aria-label="撤销"
                        onPress={() => editor?.chain().focus().undo().run()}
                    >
                        ↶
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        isIconOnly
                        aria-label="重做"
                        onPress={() => editor?.chain().focus().redo().run()}
                    >
                        ↷
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        isIconOnly
                        aria-label="分割线"
                        onPress={() =>
                            editor?.chain().focus().setHorizontalRule().run()
                        }
                    >
                        ―
                    </Button>
                </div>
            )}
            <div className="flex-1 overflow-auto">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
}
