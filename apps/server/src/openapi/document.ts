import { OpenAPIHono, type RouteConfig } from "@hono/zod-openapi";

import { routes, sessionCookieSecurityScheme } from "./routes.js";

function registerDocRoute(docApp: OpenAPIHono, route: RouteConfig): void {
    docApp.openapi(route as never, (() => "stub") as never);
}

const docApp = new OpenAPIHono();

docApp.openAPIRegistry.registerComponent(
    "securitySchemes",
    "sessionCookie",
    sessionCookieSecurityScheme,
);
for (const route of routes) {
    registerDocRoute(docApp, route);
}

export const openapiJson = docApp.getOpenAPIDocument({
    openapi: "3.0.0",
    info: {
        title: "NextCoding API",
        version: "1.0.0",
        description:
            "NextCoding 代码创作社区平台 API。\n\n作品版本管理采用与 git 同构的裸仓库模型（内容寻址 blob/tree/commit 哈希链 + refs），相关端点集中在「裸仓库」与「版本」分组。",
    },
    servers: [{ url: "http://localhost:3000", description: "本地开发" }],
    tags: [
        { name: "作品", description: "作品目录、详情与发布" },
        { name: "文件", description: "作品文件管理" },
        { name: "版本", description: "版本提交、快照与回滚" },
        { name: "裸仓库", description: "git 同构的仓库清单/对象/提交同步" },
        { name: "Git", description: "Git 仓库导入导出与推送" },
        { name: "社交", description: "评论、火花、Remix、收藏、举报" },
        { name: "排行", description: "作品榜与贡献者榜" },
        { name: "通知", description: "站内通知" },
    ],
});
