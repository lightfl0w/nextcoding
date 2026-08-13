import type { ReactNode } from "react";

export function AuthLayout({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle: string;
    children: ReactNode;
}) {
    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md flex flex-col gap-6">
                <div className="flex flex-col items-center gap-3">
                    <img
                        src="/logo.png"
                        alt="NextCoding 吉祥物"
                        className="w-16 h-16 rounded-2xl object-cover shadow-sm"
                    />
                    <div className="text-center">
                        <h1 className="text-2xl font-bold tracking-tight text-balance">
                            {title}
                        </h1>
                        <p className="text-sm text-foreground/60">{subtitle}</p>
                    </div>
                </div>
                {children}
            </div>
        </div>
    );
}
