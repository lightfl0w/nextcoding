import {
    Button,
    Chip,
    Input,
    Label,
    Modal,
    Spinner,
    TextArea,
    toast,
} from "@heroui/react";
import { Camera, ImagePlus, Rocket, Trash2, X } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";

const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 32;

/**
 * 发布作品弹窗：填写/确认标题、简介、标签与封面后提交发布。
 * @param props.open - 是否打开。
 * @param props.submitting - 是否提交中。
 * @param props.initial - 初始值。
 * @param props.initial.title - 初始标题。
 * @param props.initial.description - 初始简介。
 * @param props.initial.tags - 初始标签列表。
 * @param props.initial.coverUrl - 封面地址。
 * @param props.coverUploading - 封面是否上传中。
 * @param props.onPickCover - 选择本地封面文件。
 * @param props.onCaptureRunCover - 从运行截图生成封面。
 * @param props.onRemoveCover - 移除封面。
 * @param props.onCancel - 取消。
 * @param props.onConfirm - 确认发布（含元信息）。
 * @remarks 封面字段复用编辑器设置里的上传/截图能力，标签通过回车添加、可删除。
 */
export function PublishWorkDialog({
    open,
    submitting,
    initial,
    coverUploading,
    onPickCover,
    onCaptureRunCover,
    onRemoveCover,
    onCancel,
    onConfirm,
}: {
    open: boolean;
    submitting: boolean;
    initial: {
        title: string;
        description: string | null;
        tags: string[];
        coverUrl: string | null;
    };
    coverUploading: boolean;
    onPickCover: (file: File) => void;
    onCaptureRunCover: () => void;
    onRemoveCover: () => void;
    onCancel: () => void;
    onConfirm: (values: {
        title: string;
        description: string | null;
        tags: string[];
    }) => void;
}) {
    const [title, setTitle] = useState(initial.title);
    const [description, setDescription] = useState(initial.description ?? "");
    const [tags, setTags] = useState<string[]>(initial.tags);
    const [tagDraft, setTagDraft] = useState("");
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const commitTag = (raw: string) => {
        const tag = raw.trim().slice(0, MAX_TAG_LENGTH);
        if (!tag) {
            return;
        }
        setTags((prev) =>
            prev.includes(tag) || prev.length >= MAX_TAGS
                ? prev
                : [...prev, tag],
        );
    };

    const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            commitTag(tagDraft);
            setTagDraft("");
        } else if (
            event.key === "Backspace" &&
            tagDraft === "" &&
            tags.length > 0
        ) {
            setTags((prev) => prev.slice(0, -1));
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) {
            return;
        }
        if (!file.type.startsWith("image/")) {
            toast.danger("请选择图片文件");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.danger("图片不能超过 5 MB");
            return;
        }
        onPickCover(file);
    };

    const handleConfirm = () => {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            toast.danger("请填写作品标题");
            return;
        }
        onConfirm({
            title: trimmedTitle,
            description: description.trim() ? description.trim() : null,
            tags,
        });
    };

    return (
        <Modal
            isOpen={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen && !submitting && !coverUploading) {
                    onCancel();
                }
            }}
        >
            <Modal.Backdrop>
                <Modal.Container size="lg">
                    <Modal.Dialog className="max-w-2xl">
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Icon />
                            <Modal.Heading>发布作品</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <Label>作品封面</Label>
                                <div className="relative w-full group overflow-hidden rounded-xl border border-default-200/70 bg-default-100/60">
                                    {initial.coverUrl ? (
                                        <img
                                            src={initial.coverUrl}
                                            alt="作品封面"
                                            className="aspect-[4/3] w-full object-cover"
                                        />
                                    ) : (
                                        <div className="aspect-[4/3] w-full flex items-center justify-center text-xs text-foreground/40">
                                            暂无封面
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-1.5 flex-wrap">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="gap-1.5"
                                        isDisabled={coverUploading}
                                        onPress={() =>
                                            fileInputRef.current?.click()
                                        }
                                    >
                                        <ImagePlus className="size-3.5" />
                                        上传封面
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="gap-1.5"
                                        isDisabled={coverUploading}
                                        onPress={onCaptureRunCover}
                                    >
                                        <Camera className="size-3.5" />
                                        从运行截图生成
                                    </Button>
                                    {initial.coverUrl && (
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            className="gap-1.5"
                                            isDisabled={coverUploading}
                                            onPress={onRemoveCover}
                                        >
                                            <Trash2 className="size-3.5" />
                                            移除
                                        </Button>
                                    )}
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/gif"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="work-title">作品标题</Label>
                                <Input
                                    id="work-title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="给作品起个名字"
                                    maxLength={80}
                                    variant="secondary"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="work-description">
                                    作品简介
                                </Label>
                                <TextArea
                                    id="work-description"
                                    value={description}
                                    onChange={(e) =>
                                        setDescription(e.target.value)
                                    }
                                    placeholder="介绍这个作品做了什么、怎么玩…"
                                    rows={3}
                                    maxLength={500}
                                    variant="secondary"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="work-tags">作品标签</Label>
                                {tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {tags.map((tag) => (
                                            <Chip
                                                key={tag}
                                                size="sm"
                                                variant="soft"
                                                className="gap-1"
                                            >
                                                {tag}
                                                <button
                                                    type="button"
                                                    aria-label={`移除标签 ${tag}`}
                                                    onClick={() =>
                                                        setTags((prev) =>
                                                            prev.filter(
                                                                (t) =>
                                                                    t !== tag,
                                                            ),
                                                        )
                                                    }
                                                    className="rounded-full hover:text-danger"
                                                >
                                                    <X className="size-3" />
                                                </button>
                                            </Chip>
                                        ))}
                                    </div>
                                )}
                                <Input
                                    id="work-tags"
                                    value={tagDraft}
                                    onChange={(e) =>
                                        setTagDraft(e.target.value)
                                    }
                                    onKeyDown={handleTagKeyDown}
                                    placeholder="输入标签后回车添加"
                                    maxLength={MAX_TAG_LENGTH}
                                    variant="secondary"
                                    readOnly={tags.length >= MAX_TAGS}
                                />
                                <p className="text-xs text-foreground/40">
                                    回车添加标签，最多 {MAX_TAGS} 个
                                </p>
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button
                                slot="close"
                                variant="tertiary"
                                isDisabled={submitting || coverUploading}
                                onPress={onCancel}
                            >
                                取消
                            </Button>
                            <Button
                                slot="close"
                                variant="primary"
                                className="gap-1.5"
                                isDisabled={submitting || coverUploading}
                                onPress={handleConfirm}
                            >
                                {submitting || coverUploading ? (
                                    <Spinner size="sm" color="current" />
                                ) : (
                                    <Rocket className="size-4" />
                                )}
                                发布
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}