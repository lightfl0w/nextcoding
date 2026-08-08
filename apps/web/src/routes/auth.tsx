import {
    Alert,
    Button,
    Checkbox,
    FieldError,
    Form,
    Input,
    Label,
    TextField,
} from "@heroui/react";
import { authClient } from "@nextcoding/auth/client";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useState } from "react";

const MODES = ["login", "register", "forgot"] as const;
type AuthMode = (typeof MODES)[number];

export const Route = createFileRoute("/auth")({
    validateSearch: (search: Record<string, unknown>) => ({
        mode: MODES.includes(search.mode as AuthMode)
            ? (search.mode as AuthMode)
            : "login",
        redirect: (search.redirect as string | undefined) ?? undefined,
    }),
    component: AuthPage,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(value: string): string | null {
    if (!value) return "请输入邮箱";
    if (!EMAIL_RE.test(value)) return "邮箱格式不正确";
    return null;
}

function validatePassword(value: string): string | null {
    if (!value) return "请输入密码";
    if (value.length < 8) return "密码至少需要 8 位";
    return null;
}

function safeRedirect(target: string): string {
    if (target.startsWith("/") && !target.startsWith("//")) return target;
    return "/";
}

function AuthPage() {
    const { mode, redirect } = Route.useSearch();
    const target = safeRedirect(redirect ?? "/");

    const title =
        mode === "register"
            ? "创建账号"
            : mode === "forgot"
              ? "找回密码"
              : "欢迎回来";
    const subtitle =
        mode === "register"
            ? "加入 NextCoding，分享你的编程作品"
            : mode === "forgot"
              ? "输入邮箱，我们会发送重置链接给你"
              : "登录你的 NextCoding 账号";

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
                            {title}
                        </h1>
                        <p className="text-sm text-foreground/60">{subtitle}</p>
                    </div>
                </div>

                {/* 登录 / 注册 切换 */}
                {mode !== "forgot" ? (
                    <div className="grid grid-cols-2 gap-1 p-1 rounded-xl border border-foreground/10">
                        <Link
                            to="/auth"
                            search={{ mode: "login", redirect: target }}
                            className={
                                mode === "login"
                                    ? "bg-foreground/5 text-foreground rounded-lg py-2 text-center text-sm font-medium"
                                    : "text-foreground/50 hover:text-foreground py-2 text-center text-sm font-medium"
                            }
                        >
                            登录
                        </Link>
                        <Link
                            to="/auth"
                            search={{ mode: "register", redirect: target }}
                            className={
                                mode === "register"
                                    ? "bg-foreground/5 text-foreground rounded-lg py-2 text-center text-sm font-medium"
                                    : "text-foreground/50 hover:text-foreground py-2 text-center text-sm font-medium"
                            }
                        >
                            注册
                        </Link>
                    </div>
                ) : null}

                {mode === "login" ? <LoginForm redirect={target} /> : null}
                {mode === "register" ? (
                    <RegisterForm redirect={target} />
                ) : null}
                {mode === "forgot" ? <ForgotForm redirect={target} /> : null}
            </div>
        </div>
    );
}

function FormError({ message, title }: { message: string; title: string }) {
    return (
        <Alert status="danger">
            <Alert.Content>
                <Alert.Title>{title}</Alert.Title>
                <Alert.Description>{message}</Alert.Description>
            </Alert.Content>
        </Alert>
    );
}

function LoginForm({ redirect }: { redirect: string }) {
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

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

function RegisterForm({ redirect }: { redirect: string }) {
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
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
                validate={(value) =>
                    value.length < 2 ? "昵称至少需要 2 个字符" : null
                }
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

function ForgotForm({ redirect }: { redirect: string }) {
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sent, setSent] = useState(false);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
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
                <Alert status="success">
                    <Alert.Content>
                        <Alert.Title>重置链接已发送</Alert.Title>
                        <Alert.Description>
                            如果该邮箱已注册，你会收到一封包含重置链接的邮件，链接
                            1 小时内有效。
                        </Alert.Description>
                    </Alert.Content>
                </Alert>
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
