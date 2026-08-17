import { Alert } from "@heroui/react";

interface AlertBoxProps {
    status: "danger" | "success";
    title: string;
    message: string;
}

/**
 * 表单提示条：错误/成功两种状态。
 * @param props.status - 提示状态。
 * @param props.title - 标题。
 * @param props.message - 描述内容。
 */
export function AlertBox({ status, title, message }: AlertBoxProps) {
    return (
        <Alert status={status}>
            <Alert.Content>
                <Alert.Title>{title}</Alert.Title>
                <Alert.Description>{message}</Alert.Description>
            </Alert.Content>
        </Alert>
    );
}
