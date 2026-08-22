import {
    Button,
    Input,
    Label,
    Modal,
    TextField,
    toast,
    useOverlayState,
} from "@heroui/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpen, Plus } from "lucide-react";
import { useState } from "react";
import { NovelsGrid } from "~/components/novels/NovelsGrid";
import { EmptyState } from "~/components/ui/EmptyState";
import { PageHeader } from "~/components/ui/PageHeader";
import { useNovels } from "~/hooks/useNovels";
import { createNovel } from "~/lib/api/novels";

export const Route = createFileRoute("/novels/")({
    component: NovelsPage,
});

function NovelsPage() {
    const { novels, isLoading } = useNovels();
    const navigate = useNavigate();
    const [title, setTitle] = useState("");
    const [desc, setDesc] = useState("");
    const addState = useOverlayState();

    const openAdd = () => {
        setTitle("");
        setDesc("");
        addState.open();
    };

    const confirmAdd = async () => {
        const value = title.trim();
        if (!value) {
            toast.danger("请输入小说名称");
            return;
        }
        try {
            const { id } = await createNovel(value, desc);
            addState.close();
            navigate({ to: "/novels/$id/edit", params: { id } });
        } catch (error) {
            toast.danger((error as Error).message || "创建失败");
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
            <PageHeader
                title="小说"
                description="写下你的故事，按章节管理，随时续写与回读"
                action={
                    <Button
                        variant="primary"
                        className="gap-1.5"
                        onPress={openAdd}
                    >
                        <Plus className="size-4" />
                        新建小说
                    </Button>
                }
            />

            {isLoading ? (
                <NovelsGrid novels={[]} isLoading />
            ) : novels.length === 0 ? (
                <EmptyState
                    icon={BookOpen}
                    title="还没有小说"
                    hint="点击右上角「新建小说」，开始你的创作"
                    action={
                        <Button
                            variant="primary"
                            className="gap-1.5"
                            onPress={openAdd}
                        >
                            <Plus className="size-4" />
                            新建小说
                        </Button>
                    }
                />
            ) : (
                <NovelsGrid novels={novels} isLoading={false} />
            )}

            {/* 新建小说弹窗 */}
            <Modal state={addState}>
                <Modal.Backdrop>
                    <Modal.Container>
                        <Modal.Dialog className="sm:max-w-[440px]">
                            <Modal.CloseTrigger />
                            <Modal.Header>
                                <Modal.Heading>新建小说</Modal.Heading>
                            </Modal.Header>
                            <Modal.Body className="flex flex-col gap-4">
                                <TextField
                                    className="flex flex-col gap-1.5"
                                    value={title}
                                    onChange={setTitle}
                                >
                                    <Label className="text-xs text-foreground/60">
                                        小说名称
                                    </Label>
                                    <Input
                                        placeholder="例如：星海征途"
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                void confirmAdd();
                                            }
                                        }}
                                    />
                                </TextField>
                                <TextField
                                    className="flex flex-col gap-1.5"
                                    value={desc}
                                    onChange={setDesc}
                                >
                                    <Label className="text-xs text-foreground/60">
                                        简介（可选）
                                    </Label>
                                    <Input placeholder="一句话介绍你的故事" />
                                </TextField>
                            </Modal.Body>
                            <Modal.Footer>
                                <Button slot="close" variant="tertiary">
                                    取消
                                </Button>
                                <Button variant="primary" onPress={confirmAdd}>
                                    创建
                                </Button>
                            </Modal.Footer>
                        </Modal.Dialog>
                    </Modal.Container>
                </Modal.Backdrop>
            </Modal>
        </div>
    );
}
