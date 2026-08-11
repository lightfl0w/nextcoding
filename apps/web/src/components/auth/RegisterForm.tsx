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
import {
    safeRedirect,
    validateEmail,
    validateName,
    validatePassword,
} from "~/lib/validation";
import { FormError } from "./AuthAlert";

export function RegisterForm({ redirect }: { redirect: string }) {
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const password = String(formData.get("password") ?? "");
        const confirmPassword = String(formData.get("confirmPassword") ?? "");

        setError(null);
        if (password !== confirmPassword) {
            setError("两次输入的密码不一致");
            return;
        }

        setIsSubmitting(true);
        const { error: signUpError } = await authClient.signUp.email({
            name: String(formData.get("name") ?? "").trim(),
            email: String(formData.get("email") ?? "").trim(),
            password,
            callbackURL: redirect,
        });
        setIsSubmitting(false);

        if (signUpError) {
            setError(signUpError.message ?? "注册失败，请稍后重试");
            return;
        }
        window.location.assign(safeRedirect(redirect));
    }

    return (
        <Form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 p-6 rounded-2xl border border-foreground/10 bg-surface"
        >
            <TextField
                isRequired
                name="name"
                autoComplete="nickname"
                minLength={2}
                validate={validateName}
            >
                <Label>昵称</Label>
                <Input placeholder="怎么称呼你？" />
                <FieldError />
            </TextField>

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

            <TextField
                isRequired
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                validate={validatePassword}
            >
                <Label>密码</Label>
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
                <Label>确认密码</Label>
                <Input placeholder="再输入一次密码" />
                <FieldError />
            </TextField>

            {error ? <FormError title="注册失败" message={error} /> : null}

            <Button type="submit" fullWidth isPending={isSubmitting}>
                注册
            </Button>

            <p className="text-sm text-center text-foreground/50">
                已有账号？{" "}
                <Link
                    to="/auth"
                    search={{ mode: "login", redirect }}
                    className="text-accent hover:underline"
                >
                    去登录
                </Link>
            </p>
        </Form>
    );
}
