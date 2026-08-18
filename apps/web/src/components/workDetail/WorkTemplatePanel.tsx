import {
    Button,
    Label,
    Modal,
    Radio,
    RadioGroup,
    Spinner,
    type useOverlayState,
} from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { BarChart3, LayoutTemplate, Link as LinkIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { ToggleSwitch } from "~/components/settings/ToggleSwitch";
import { useWorkTemplate } from "~/hooks/useWorkTemplate";
import type { WorkDetail } from "~/lib/api/types";
import { formatCount } from "~/lib/format";
import { TEMPLATE_CATEGORIES } from "~/lib/templateCategories";

/**
 * 作者视角的模板设置面板。
 * @param props.work - 作品详情。
 * @param props.state - 弹窗开关状态。
 * @param props.isOwner - 是否本人作品。
 * @remarks 提供「允许作为模板」开关、被使用统计与数据面板入口。
 */
export function WorkTemplatePanel({
    work,
    state,
    isOwner,
}: {
    work: WorkDetail;
    state: ReturnType<typeof useOverlayState>;
    isOwner: boolean;
}) {
    const { isTemplate, useCount, pending, handleEnable, handleDisable } =
        useWorkTemplate(work);
    const [category, setCategory] = useState<string>("frontend");

    useEffect(() => {
        if (state.isOpen) {
            setCategory("frontend");
        }
    }, [state.isOpen]);

    const handleToggle = (checked: boolean) => {
        if (checked) {
            state.open();
            return;
        }
        void handleDisable();
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-medium text-foreground">
                        允许作为模板
                    </span>
                    <span className="text-xs text-foreground/45 leading-relaxed">
                        开启后其他用户可基于此作品一键创作
                    </span>
                </div>
                <ToggleSwitch
                    isSelected={isTemplate}
                    onChange={handleToggle}
                    label="允许作为模板"
                />
            </div>

            {isTemplate && (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs text-foreground/55">
                        <LayoutTemplate className="size-3.5 text-primary" />
                        <span>
                            已被使用{" "}
                            <span className="font-semibold text-foreground">
                                {formatCount(useCount)}
                            </span>{" "}
                            次
                        </span>
                    </div>
                    {isOwner && work.templateKey && (
                        <Link
                            to="/templates/$id"
                            params={{ id: work.templateKey }}
                            className="flex items-center gap-1.5 text-xs text-accent hover:underline w-fit"
                        >
                            <BarChart3 className="size-3.5" />
                            查看数据面板
                        </Link>
                    )}
                </div>
            )}

            <Modal state={state}>
                <Modal.Backdrop>
                    <Modal.Container>
                        <Modal.Dialog className="sm:max-w-[440px]">
                            <Modal.CloseTrigger />
                            <Modal.Header>
                                <Modal.Heading className="flex items-center gap-2">
                                    <LayoutTemplate className="size-4" />
                                    开放为模板
                                </Modal.Heading>
                            </Modal.Header>
                            <Modal.Body className="flex flex-col gap-4">
                                <p className="text-sm text-foreground/60 leading-relaxed">
                                    将当前作品的所有文件打包为模板快照，
                                    上架到模板市场。其他用户使用后生成独立草稿，
                                    不影响你的作品。
                                </p>
                                <RadioGroup
                                    className="flex flex-col gap-1.5"
                                    value={category}
                                    onChange={setCategory}
                                >
                                    <Label className="text-xs text-foreground/60">
                                        模板分类
                                    </Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {TEMPLATE_CATEGORIES.map((item) => (
                                            <Radio
                                                key={item.id}
                                                value={item.id}
                                            >
                                                {item.label}
                                            </Radio>
                                        ))}
                                    </div>
                                </RadioGroup>
                                <div className="flex items-center gap-1.5 text-xs text-foreground/45">
                                    <LinkIcon className="size-3" />
                                    可随时在面板中关闭或查看数据面板
                                </div>
                            </Modal.Body>
                            <Modal.Footer>
                                <Button
                                    slot="close"
                                    variant="tertiary"
                                    isDisabled={pending}
                                >
                                    取消
                                </Button>
                                <Button
                                    slot="close"
                                    variant="primary"
                                    isDisabled={pending}
                                    onPress={() =>
                                        void handleEnable({ category })
                                    }
                                >
                                    {pending && (
                                        <Spinner size="sm" color="current" />
                                    )}
                                    确认开放
                                </Button>
                            </Modal.Footer>
                        </Modal.Dialog>
                    </Modal.Container>
                </Modal.Backdrop>
            </Modal>
        </div>
    );
}
