export const MIN_PASSWORD_LENGTH = 8;
export const MIN_NAME_LENGTH = 2;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | null {
    if (!value) {
        return "请输入邮箱";
    }
    if (!EMAIL_RE.test(value)) {
        return "邮箱格式不正确";
    }
    return null;
}

export function validatePassword(value: string): string | null {
    if (!value) {
        return "请输入密码";
    }
    if (value.length < MIN_PASSWORD_LENGTH) {
        return `密码至少需要 ${MIN_PASSWORD_LENGTH} 位`;
    }
    return null;
}

export function validateName(value: string): string | null {
    if (!value) {
        return "请输入昵称";
    }
    if (value.length < MIN_NAME_LENGTH) {
        return `昵称至少需要 ${MIN_NAME_LENGTH} 个字符`;
    }
    return null;
}

export function safeRedirect(target: string | undefined): string {
    const fallback = "/";
    if (!target) {
        return fallback;
    }
    if (target.startsWith("/") && !target.startsWith("//")) {
        return target;
    }
    return fallback;
}
