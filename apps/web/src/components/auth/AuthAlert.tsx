import { Alert } from "@heroui/react";

export function FormError({
    title,
    message,
}: {
    title: string;
    message: string;
}) {
    return (
        <Alert status="danger">
            <Alert.Content>
                <Alert.Title>{title}</Alert.Title>
                <Alert.Description>{message}</Alert.Description>
            </Alert.Content>
        </Alert>
    );
}

export function SuccessAlert({
    title,
    message,
}: {
    title: string;
    message: string;
}) {
    return (
        <Alert status="success">
            <Alert.Content>
                <Alert.Title>{title}</Alert.Title>
                <Alert.Description>{message}</Alert.Description>
            </Alert.Content>
        </Alert>
    );
}
