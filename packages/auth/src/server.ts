import { account, db, session, user, verification } from "@nextcoding/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";

async function sendAuthEmail(to: string, subject: string, body: string) {
    console.log(`[auth:email] to=${to} subject=${subject}\n${body}`);
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

    
    
    
    
    
    
    
    
    

    trustedOrigins: ["http://localhost:5173", "http://localhost:3000"],

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
