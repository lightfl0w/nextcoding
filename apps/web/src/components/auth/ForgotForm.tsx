import {
    Button,
    FieldError,
    Form,
    Input,
    Label,
    TextField,
} from "@heroui/react";
import { authClient } from "@nextcoding/auth/client";
import { Link } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useState } from "react";
import { validateEmail } from "~/lib/validation";
import { FormError, SuccessAlert } from "./AuthAlert";

export function ForgotForm({ redirect }: { redirect: string }) {
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sent, setSent] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const email = String(formData.get("email") ?? "").trim();

        setError(null);
        setSent(false);
        setIsSubmitting(true);
        const { error: resetError } = await authClient.requestPasswordReset({
            email,
            redirectTo: `${window.location.origin}/reset-password`,
        });
        setIsSubmitting(false);

        if (resetError) {
            setError(resetError.message ?? "发送失败，请稍后重试");
        } else {
            setSent(true);
        }
    }

    return (
        <Form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 p-6 rounded-2xl border border-foreground/10 bg-surface"
        >
            {sent ? (
                <SuccessAlert
                    title="重置链接已发送"
                    message="如果该邮箱已注册，你会收到一封包含重置链接的邮件，链接 1 小时内有效。"
                />
            ) : null}

            <TextField
                isRequired
                name="email"
                type="email"
                autoComplete="email"
                validate={validateEmail}
            >
                <Label>邮箱</Label>
                <Input placeholder="you@example.com" />
                <FieldError />
            </TextField>

            {error ? <FormError title="发送失败" message={error} /> : null}

            <Button type="submit" fullWidth isPending={isSubmitting}>
                发送重置链接
            </Button>

            <p className="text-sm text-center text-foreground/50">
                想起来了？{" "}
                <Link
                    to="/auth"
                    search={{ mode: "login", redirect }}
                    className="text-accent hover:underline"
                >
                    返回登录
                </Link>
            </p>
        </Form>
    );
}
