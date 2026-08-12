import {
    Button,
    Label,
    Modal,
    Slider,
    Spinner,
    useOverlayState,
} from "@heroui/react";
import { Check, Crop } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

const OUTPUT_SIZE = 512;
const OUTPUT_TYPE = "image/png";

/**
 * 将图片文件裁剪为指定区域，输出为正方形 PNG。
 * @param image - 已加载的 HTMLImageElement。
 * @param pixelCrop - 裁剪区域（原始像素坐标）。
 * @returns 裁剪后的 File 对象。
 */
function cropImage(image: HTMLImageElement, pixelCrop: Area): Promise<File> {
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Canvas 2D 上下文不可用");
    }
    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE,
    );
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error("裁剪失败"));
                    return;
                }
                resolve(new File([blob], "avatar.png", { type: OUTPUT_TYPE }));
            },
            OUTPUT_TYPE,
            0.92,
        );
    });
}

/**
 * 头像裁剪弹窗。
 * 用户选择图片文件后弹出，支持拖拽定位与缩放，
 * 确认后通过 onCrop 回调返回裁剪好的 File。
 */
export function AvatarCropModal({
    file,
    onCrop,
    onCancel,
}: {
    file: File | null;
    onCrop: (croppedFile: File) => void;
    onCancel: () => void;
}) {
    const state = useOverlayState();
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [imageError, setImageError] = useState(false);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [isProcessing, setIsProcessing] = useState(false);
    const croppedAreaRef = useRef<Area | null>(null);
    const imageElRef = useRef<HTMLImageElement | null>(null);

    useEffect(() => {
        if (!file) {
            setImageSrc(null);
            return;
        }
        const url = URL.createObjectURL(file);
        setImageSrc(url);
        setImageError(false);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        croppedAreaRef.current = null;
        state.open();
        return () => {
            URL.revokeObjectURL(url);
        };
    }, [file, state.open]);

    const onCropComplete = useCallback(
        (_croppedArea: Area, croppedAreaPixels: Area) => {
            croppedAreaRef.current = croppedAreaPixels;
        },
        [],
    );

    const handleConfirm = async () => {
        if (!imageElRef.current || !croppedAreaRef.current) {
            return;
        }
        setIsProcessing(true);
        try {
            const croppedFile = await cropImage(
                imageElRef.current,
                croppedAreaRef.current,
            );
            state.close();
            onCrop(croppedFile);
        } catch {
            state.close();
            onCancel();
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancel = () => {
        state.close();
        onCancel();
    };

    useEffect(() => {
        if (!imageSrc) {
            imageElRef.current = null;
            setImageError(false);
            return;
        }
        const img = new Image();
        img.onload = () => {
            imageElRef.current = img;
        };
        img.onerror = () => {
            imageElRef.current = null;
            setImageError(true);
        };
        img.src = imageSrc;
    }, [imageSrc]);

    return (
        <Modal state={state}>
            <Modal.Backdrop>
                <Modal.Container>
                    <Modal.Dialog className="sm:max-w-[400px]">
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading className="flex items-center gap-2">
                                <Crop className="size-4" />
                                裁剪头像
                            </Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="flex flex-col gap-4">
                            {imageSrc && !imageError && (
                                <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-default-100">
                                    <Cropper
                                        image={imageSrc}
                                        crop={crop}
                                        zoom={zoom}
                                        aspect={1}
                                        cropShape="round"
                                        showGrid
                                        onCropChange={setCrop}
                                        onZoomChange={setZoom}
                                        onCropComplete={onCropComplete}
                                        minZoom={1}
                                        maxZoom={3}
                                    />
                                </div>
                            )}
                            {imageError && (
                                <div className="w-full aspect-square rounded-xl overflow-hidden bg-default-100 flex items-center justify-center text-sm text-foreground/60">
                                    图片无法读取，请重新选择
                                </div>
                            )}
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-foreground/60">
                                        缩放
                                    </Label>
                                    <span className="text-xs text-foreground/40 tabular-nums">
                                        {zoom.toFixed(1)}x
                                    </span>
                                </div>
                                <Slider
                                    minValue={1}
                                    maxValue={3}
                                    step={0.01}
                                    value={zoom}
                                    onChange={(v) => setZoom(v as number)}
                                    className="w-full"
                                >
                                    <Slider.Track>
                                        <Slider.Fill />
                                        <Slider.Thumb />
                                    </Slider.Track>
                                </Slider>
                            </div>
                            <p className="text-[11px] text-foreground/40 text-center">
                                拖拽图片调整位置，滑动滚轮或拖动滑块缩放
                            </p>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button
                                variant="tertiary"
                                onPress={handleCancel}
                                isDisabled={isProcessing}
                            >
                                取消
                            </Button>
                            <Button
                                variant="primary"
                                onPress={handleConfirm}
                                isDisabled={isProcessing}
                            >
                                {isProcessing ? (
                                    <>
                                        <Spinner
                                            size="sm"
                                            className="!size-3.5"
                                        />
                                        应用中
                                    </>
                                ) : (
                                    <>
                                        <Check className="size-3.5" />
                                        应用
                                    </>
                                )}
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
