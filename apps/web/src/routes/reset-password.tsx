import {
    Alert,
    Button,
    FieldError,
    Form,
    Input,
    Label,
    TextField,
} from "@heroui/react";
import { authClient } from "@nextcoding/auth/client";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useState } from "react";

import { AuthLayout } from "~/components/auth/AuthLayout";
import { validatePassword } from "~/lib/validation";

const REDIRECT_DELAY_MS = 1500;

export const Route = createFileRoute("/reset-password")({
    validateSearch: (search: Record<string, unknown>) => ({
        token: (search.token as string | undefined) ?? "",
    }),
    component: ResetPasswordRoute,
});

function ResetPasswordRoute() {
    const { token } = Route.useSearch();
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [done, setDone] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const newPassword = String(formData.get("password") ?? "");
        const confirmPassword = String(formData.get("confirmPassword") ?? "");

        setError(null);
        if (newPassword !== confirmPassword) {
            setError("两次输入的密码不一致");
            return;
        }
        if (!token) {
            setError("重置链接无效或已过期，请重新发起找回密码");
            return;
        }

        setIsSubmitting(true);
        const { error: resetError } = await authClient.resetPassword({
            newPassword,
            token,
        });
        setIsSubmitting(false);

        if (resetError) {
            setError(resetError.message ?? "重置失败，链接可能已过期");
            return;
        }

        setDone(true);
        setTimeout(() => {
            navigate({ to: "/auth", search: { mode: "login", redirect: "/" } });
        }, REDIRECT_DELAY_MS);
    }

    return (
        <AuthLayout title="设置新密码" subtitle="输入一个新的登录密码">
            <Form
                onSubmit={handleSubmit}
                className="flex flex-col gap-4 p-6 rounded-2xl border border-foreground/10 bg-surface"
            >
                {done ? (
                    <Alert status="success">
                        <Alert.Content>
                            <Alert.Title>密码已重置</Alert.Title>
                            <Alert.Description>
                                正在跳转到登录页…
                            </Alert.Description>
                        </Alert.Content>
                    </Alert>
                ) : null}

                <TextField
                    isRequired
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    validate={validatePassword}
                >
                    <Label>新密码</Label>
                    <Input placeholder="至少 8 位" />
                    <FieldError />
                </TextField>

                <TextField
                    isRequired
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                >
                    <Label>确认新密码</Label>
                    <Input placeholder="再输入一次新密码" />
                    <FieldError />
                </TextField>

                {error ? (
                    <Alert status="danger">
                        <Alert.Content>
                            <Alert.Title>重置失败</Alert.Title>
                            <Alert.Description>{error}</Alert.Description>
                        </Alert.Content>
                    </Alert>
                ) : null}

                <Button type="submit" fullWidth isPending={isSubmitting}>
                    重置密码
                </Button>

                <p className="text-sm text-center text-foreground/50">
                    想起来了？{" "}
                    <Link
                        to="/auth"
                        search={{ mode: "login", redirect: "/" }}
                        className="text-accent hover:underline"
                    >
                        返回登录
                    </Link>
                </p>
            </Form>
        </AuthLayout>
    );
}
