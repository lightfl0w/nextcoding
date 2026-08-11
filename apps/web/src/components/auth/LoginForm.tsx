import {
    Button,
    Checkbox,
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
    validatePassword,
} from "~/lib/validation";
import { FormError } from "./AuthAlert";

export function LoginForm({ redirect }: { redirect: string }) {
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setError(null);
        setIsSubmitting(true);
        const { error: signInError } = await authClient.signIn.email({
            email: String(formData.get("email") ?? "").trim(),
            password: String(formData.get("password") ?? ""),
            rememberMe: formData.get("remember") === "on",
            callbackURL: redirect,
        });
        setIsSubmitting(false);

        if (signInError) {
            setError(signInError.message ?? "登录失败，请检查邮箱和密码");
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
                autoComplete="current-password"
                minLength={8}
                validate={validatePassword}
            >
                <Label>密码</Label>
                <Input placeholder="请输入密码" />
                <FieldError />
            </TextField>

            <div className="flex items-center justify-between">
                <Checkbox name="remember" value="on" defaultSelected>
                    <Checkbox.Content>
                        <Checkbox.Control>
                            <Checkbox.Indicator />
                        </Checkbox.Control>
                        记住我
                    </Checkbox.Content>
                </Checkbox>
                <Link
                    to="/auth"
                    search={{ mode: "forgot", redirect }}
                    className="text-sm text-accent hover:underline"
                >
                    忘记密码？
                </Link>
            </div>

            {error ? <FormError title="登录失败" message={error} /> : null}

            <Button type="submit" fullWidth isPending={isSubmitting}>
                登录
            </Button>

            <p className="text-sm text-center text-foreground/50">
                还没有账号？{" "}
                <Link
                    to="/auth"
                    search={{ mode: "register", redirect }}
                    className="text-accent hover:underline"
                >
                    立即注册
                </Link>
            </p>
        </Form>
    );
}
