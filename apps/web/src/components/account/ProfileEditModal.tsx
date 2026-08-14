import {
    Avatar,
    Button,
    Input,
    Label,
    Modal,
    Spinner,
    TextArea,
    toast,
    type useOverlayState,
} from "@heroui/react";
import { Camera } from "lucide-react";
import { useRef, useState } from "react";
import { AvatarCropModal } from "~/components/AvatarCropModal";
import { uploadAvatar } from "~/lib/api";

const AVATAR_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

export function ProfileEditModal({
    state,
    name,
    image,
    bio,
    onNameChange,
    onBioChange,
    onSave,
}: {
    state: ReturnType<typeof useOverlayState>;
    name: string;
    image: string;
    bio: string;
    onNameChange: (value: string) => void;
    onBioChange: (value: string) => void;
    onSave: (nextImage?: string) => void;
}) {
    return (
        <Modal state={state}>
            <Modal.Backdrop>
                <Modal.Container>
                    <Modal.Dialog className="sm:max-w-110">
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>修改资料</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="flex flex-col gap-4">
                            <AvatarField
                                name={name}
                                image={image}
                                onUploaded={(url) => onSave(url)}
                            />
                            <div className="flex flex-col gap-1.5">
                                <Label>昵称</Label>
                                <Input
                                    autoFocus
                                    placeholder="你的昵称"
                                    value={name}
                                    onChange={(event) =>
                                        onNameChange(event.target.value)
                                    }
                                    onKeyDown={(event) =>
                                        event.key === "Enter" && onSave()
                                    }
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label>简介</Label>
                                <TextArea
                                    placeholder="介绍一下自己（可选）"
                                    value={bio}
                                    onChange={(event) =>
                                        onBioChange(event.target.value)
                                    }
                                />
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button slot="close" variant="tertiary">
                                取消
                            </Button>
                            <Button
                                variant="primary"
                                isDisabled={!name.trim()}
                                onPress={() => onSave()}
                            >
                                保存
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}

function AvatarField({
    name,
    image,
    onUploaded,
}: {
    name: string;
    image: string;
    onUploaded: (url: string) => void;
}) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [localPreview, setLocalPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);

    const effectiveAvatarSrc = localPreview ?? image;

    const handlePickFile = () => {
        fileInputRef.current?.click();
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
        setPendingCropFile(file);
    };

    const handleCropped = async (croppedFile: File) => {
        if (localPreview) {
            URL.revokeObjectURL(localPreview);
        }
        const preview = URL.createObjectURL(croppedFile);
        setLocalPreview(preview);
        setPendingCropFile(null);
        setIsUploading(true);
        try {
            const result = await uploadAvatar(croppedFile);
            onUploaded(result.url);
        } catch (err) {
            toast.danger((err as Error).message);
        } finally {
            URL.revokeObjectURL(preview);
            setLocalPreview(null);
            setIsUploading(false);
        }
    };

    const handleCropCancel = () => {
        setPendingCropFile(null);
    };

    return (
        <>
            <div className="flex flex-col gap-2 items-center">
                <Label>头像</Label>
                <div className="relative">
                    <Avatar
                        size="lg"
                        className="size-24 ring-2 ring-default-200"
                    >
                        {effectiveAvatarSrc ? (
                            <Avatar.Image
                                alt="头像预览"
                                src={effectiveAvatarSrc}
                            />
                        ) : null}
                        <Avatar.Fallback className="text-2xl">
                            {name ? name.trim().charAt(0).toUpperCase() : "?"}
                        </Avatar.Fallback>
                    </Avatar>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={AVATAR_ACCEPT}
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    <Button
                        size="sm"
                        variant="secondary"
                        className="gap-1.5"
                        onPress={handlePickFile}
                        isDisabled={isUploading}
                    >
                        {isUploading ? (
                            <Spinner size="sm" className="size-3.5" />
                        ) : (
                            <Camera className="size-3.5" />
                        )}
                        {isUploading ? "应用中" : "选择图片"}
                    </Button>
                </div>
                <p className="text-[11px] text-foreground/40">
                    支持 JPG、PNG、WebP、GIF，最大 5 MB
                </p>
            </div>

            <AvatarCropModal
                file={pendingCropFile}
                onCrop={handleCropped}
                onCancel={handleCropCancel}
            />
        </>
    );
}
