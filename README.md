# NextCoding

一个支持作品发布、版本管理、Remix（fork）、Spark 打赏、评论、私信、实时通知的代码创作社区平台。

## 技术栈

| 层 | 技术 |
|---|---|
| Monorepo | pnpm workspace + Turborepo 2 |
| 前端 | React 19 + Vite 8 + TanStack Router |
| UI | HeroUI v3 + Tailwind CSS v4 |
| 代码编辑器 | Monaco Editor |
| 后端 | Hono 4 + @hono/node-server |
| 实时通讯 | ws 8（WebSocket，用户级 room + 30s 心跳） |
| 数据库 | SQLite（@libsql/client）+ Drizzle ORM |
| 认证 | Better Auth（邮箱密码 + admin 插件 + rate limit） |
| 对象存储 | 多驱动：Local / S3 兼容 / Vercel Blob |
| 测试 | Vitest 4 |
| 代码规范 | Biome 2.5 + tsc --noEmit |

## 目录结构

```
nextcoding/
├── apps/
│   ├── server/          # 后端 API + WebSocket（Hono）
│   └── web/             # 前端 SPA（Vite + React 19）
├── packages/
│   ├── auth/            # @nextcoding/auth（Better Auth 封装）
│   ├── db/              # @nextcoding/db（Drizzle + SQLite schema）
│   └── storage/         # @nextcoding/storage（多适配器对象存储）
├── .env.example
├── CODE_STYLE.md        # 代码规范（项目唯一规范文档）
├── biome.json
└── turbo.json
```

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，至少修改 `BETTER_AUTH_SECRET` 为随机 32 字符字符串。

### 3. 初始化数据库

```bash
cd packages/db
pnpm db:generate
pnpm db:migrate
```

### 4. 启动开发服务器

```bash
# 在项目根目录
pnpm dev
```

- 前端：http://localhost:5173
- 后端 API：http://localhost:3000
- WebSocket：ws://localhost:3000/ws

## 常用脚本

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 同时启动前端和后端开发服务器 |
| `pnpm test` | 运行全部测试（turbo run test） |
| `pnpm lint` | Biome 检查（必须 0 报错） |
| `pnpm lint:fix` | Biome 自动修复 |
| `pnpm format` | Biome 格式化 |

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DB_URL` | `file:./db.sqlite` | SQLite 文件路径或 libSQL 远程 URL |
| `BETTER_AUTH_SECRET` | — | 认证密钥（必须修改） |
| `BETTER_AUTH_URL` | `http://localhost:5173` | 前端地址 |
| `BACKEND_URL` | `http://localhost:3000` | 后端地址 |
| `PORT` | `3000` | 后端监听端口 |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | 允许的前端来源 |
| `STORAGE_DRIVER` | `local` | 存储驱动：`local` / `s3` / `vercel-blob` |
| `STORAGE_LOCAL_DIR` | `data` | 本地存储写入目录 |

S3 和 Vercel Blob 的配置见 [.env.example](file:///f:/nextcoding/.env.example)。

## 测试

项目使用 Vitest 4，前后端各自独立配置。

```bash
# 全量测试
pnpm test

# 仅前端
cd apps/web && pnpm test

# 仅后端
cd apps/server && pnpm test
```

- 后端：19 个测试文件，覆盖所有路由模块（338 tests）
- 前端：17 个测试文件，覆盖 API 客户端、WebSocket 流、组件（192 tests）

## 代码规范

项目遵循 [CODE_STYLE.md](file:///f:/nextcoding/CODE_STYLE.md)（项目唯一规范文档）。提交前必须通过：

```bash
pnpm lint          # Biome 检查，0 报错
pnpm -r exec tsc --noEmit  # TypeScript 类型检查，退出码 0
```

## 功能模块

- **作品系统**：发布、文件管理、版本快照、Git 导入/导出/推送
- **社交**：Remix（fork）、Spark 打赏（每日 10 额度）、评论嵌套回复、收藏
- **通知**：6 类通知 + WebSocket 实时推送
- **私信**：会话式即时通讯 + WebSocket 实时消息
- **用户**：主页、关注、活动流、成就系统
- **后台**：用户/作品/评论/标签/消息/举报/成就管理
- **编辑器**：Monaco 代码编辑器 + 终端运行（@wterm）
- **排行榜**：作品/用户排名

## AI 生成声明

本项目中的以下内容由 AI 生成：

- **README.md**：本文件由 AI 生成
- **代码注释**：源码中的 TSDoc 注释和行内注释由 AI 生成
- **单元测试**：`apps/server/test/` 和 `apps/web/test/` 下的测试文件由 AI 生成
