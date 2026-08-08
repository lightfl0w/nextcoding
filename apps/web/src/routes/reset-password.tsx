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

export const Route = createFileRoute("/reset-password")({
    validateSearch: (search: Record<string, unknown>) => ({
        token: (search.token as string | undefined) ?? "",
    }),
    component: ResetPasswordPage,
});

function ResetPasswordPage() {
    const { token } = Route.useSearch();
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [done, setDone] = useState(false);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
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
        }, 1500);
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md flex flex-col gap-6">
                <div className="flex flex-col items-center gap-2">
                    <img
                        src="/logo.png"
                        alt="NextCoding 吉祥物"
                        className="w-14 h-14 rounded-2xl object-cover"
                    />
                    <div className="text-center">
                        <h1 className="text-2xl font-bold tracking-tight">
                            设置新密码
                        </h1>
                        <p className="text-sm text-foreground/60">
                            输入一个新的登录密码
                        </p>
                    </div>
                </div>

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
                        validate={(value) => {
                            if (!value) return "请输入新密码";
                            if (value.length < 8) return "密码至少需要 8 位";
                            return null;
                        }}
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
            </div>
        </div>
    );
}
