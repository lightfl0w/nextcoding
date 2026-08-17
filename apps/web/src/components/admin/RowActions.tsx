import { Button, Dropdown, Label } from "@heroui/react";
import { MoreHorizontal } from "lucide-react";

export type RowAction = {
    id: string;
    label: string;
    variant?: "danger";
    isDisabled?: boolean;
};

interface RowActionsProps {
    label: string;
    actions: RowAction[];
    onAction: (id: string | number) => void;
}

/**
 * 管理表格行内操作菜单（MoreHorizontal 下拉）。
 * @param props.label - 菜单按钮的无障碍标签。
 * @param props.actions - 菜单项列表。
 * @param props.onAction - 选中菜单项时回调，参数为该项 id。
 */
export function RowActions({ label, actions, onAction }: RowActionsProps) {
    return (
        <Dropdown>
            <Button variant="ghost" size="sm" aria-label={label} isIconOnly>
                <MoreHorizontal className="size-4" />
            </Button>
            <Dropdown.Popover>
                <Dropdown.Menu onAction={onAction}>
                    {actions.map((action) => (
                        <Dropdown.Item
                            key={action.id}
                            id={action.id}
                            textValue={action.label}
                            variant={action.variant}
                            isDisabled={action.isDisabled}
                        >
                            <Label>{action.label}</Label>
                        </Dropdown.Item>
                    ))}
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );
}
