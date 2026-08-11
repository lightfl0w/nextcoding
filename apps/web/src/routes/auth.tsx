import { createFileRoute } from "@tanstack/react-router";

import { AuthLayout } from "~/components/auth/AuthLayout";
import { ForgotForm } from "~/components/auth/ForgotForm";
import { LoginForm } from "~/components/auth/LoginForm";
import { ModeTabs } from "~/components/auth/ModeTabs";
import { RegisterForm } from "~/components/auth/RegisterForm";
import { type AuthMode, validateAuthSearch } from "~/lib/authSearch";

export const Route = createFileRoute("/auth")({
    validateSearch: validateAuthSearch,
    component: AuthRoute,
});

const AUTH_COPY: Record<AuthMode, { title: string; subtitle: string }> = {
    login: { title: "欢迎回来", subtitle: "登录你的 NextCoding 账号" },
    register: {
        title: "创建账号",
        subtitle: "加入 NextCoding，分享你的编程作品",
    },
    forgot: {
        title: "找回密码",
        subtitle: "输入邮箱，我们会发送重置链接给你",
    },
};

function AuthRoute() {
    const { mode, redirect } = Route.useSearch();
    const { title, subtitle } = AUTH_COPY[mode];
    const safeRedirect = redirect ?? "/";
    return (
        <AuthLayout title={title} subtitle={subtitle}>
            {mode !== "forgot" && (
                <ModeTabs mode={mode} redirect={safeRedirect} />
            )}
            {mode === "login" && <LoginForm redirect={safeRedirect} />}
            {mode === "register" && <RegisterForm redirect={safeRedirect} />}
            {mode === "forgot" && <ForgotForm redirect={safeRedirect} />}
        </AuthLayout>
    );
}
