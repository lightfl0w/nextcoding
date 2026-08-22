import { account, db, session, user, verification } from "@nextcoding/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import nodemailer from "nodemailer";

/**
 * SMTP 传输器。未配置 SMTP_HOST/SMTP_USER/SMTP_PASS 时为空，
 * 此时邮件降级为日志输出（仅用于本地开发，生产必须配置 SMTP）。
 */
const smtpTransporter =
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
        ? nodemailer.createTransport({
              host: process.env.SMTP_HOST,
              port: Number(process.env.SMTP_PORT) || 465,
              secure: (process.env.SMTP_SECURE ?? "true") === "true",
              auth: {
                  user: process.env.SMTP_USER,
                  pass: process.env.SMTP_PASS,
              },
          })
        : null;

async function sendAuthEmail(to: string, subject: string, body: string) {
    if (!smtpTransporter) {
        console.log(`[auth:email] to=${to} subject=${subject}\n${body}`);
        return;
    }
    const html = body
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `<p style="margin:8px 0">${escapeHtml(line)}</p>`)
        .join("");
    await smtpTransporter.sendMail({
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
        to,
        subject,
        text: body,
        html: `<!doctype html><body style="font-family:sans-serif;color:#111">${html}</body>`,
    });
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * 允许发起认证请求的来源，从环境变量读取（与 CORS 共用 CORS_ORIGINS）。
 * 默认保留本地开发地址。
 */
function trustedOriginsFromEnv(): string[] {
    return (
        process.env.CORS_ORIGINS ??
        "http://localhost:5173,http://localhost:3000"
    )
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
}

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "sqlite",
        schema: {
            user,
            session,
            account,
            verification,
        },
    }),

    user: {
        additionalFields: {
            bio: {
                type: "string",
                required: false,
                input: true,
            },
        },
    },

    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        maxPasswordLength: 256,

        sendResetPassword: async ({ user, url }, _request) => {
            await sendAuthEmail(
                user.email,
                "重置你的 NextCoding 密码",
                `点击链接重置密码（1 小时内有效，仅可使用一次）：\n${url}`,
            );
        },

        revokeSessionsOnPasswordReset: true,
    },

    session: {
        expiresIn: 60 * 60 * 24 * 7,
        updateAge: 60 * 60 * 24,
        cookieCache: {
            enabled: true,
            maxAge: 60 * 5,
            strategy: "jwe",
        },
    },

    rateLimit: {
        enabled: true,
        window: Number(process.env.AUTH_RATE_LIMIT_WINDOW) || 60,
        max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 100,
    },

    trustedOrigins: trustedOriginsFromEnv(),

    advanced: {
        defaultCookieAttributes: {
            sameSite: "lax",
        },
        ipAddress: {
            ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
        },
    },

    databaseHooks: {
        user: {
            create: {
                after: async (user, _context) => {
                    console.log(
                        `[auth:audit] 新用户注册: ${user.email} (${user.id})`,
                    );
                },
            },
        },
        session: {
            create: {
                after: async (session, context) => {
                    const ip =
                        context?.request?.headers.get("x-forwarded-for") ??
                        "unknown";
                    console.log(
                        `[auth:audit] 用户登录: ${session.userId} ip=${ip}`,
                    );
                },
            },
            delete: {
                before: async (session, _context) => {
                    console.log(`[auth:audit] 会话注销: ${session.id}`);
                },
            },
        },
    },

    plugins: [admin()],
});
